// Files Mentto creates for the tutor to share: PDF receipts and statements (Pro) and CSV exports
// of their records (free: their data is always theirs to take).
import { File, Paths } from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Alert } from 'react-native';

import type { DB } from '@/db/core';
import { listPayments, listPlans, type Payment } from '@/db/fees';
import { listAttendedSessions } from '@/db/schedules';
import type { Student } from '@/db/students';
import { chargesFor, type FeeStatus } from '@/domain/fees';

import { formatFullDate, formatMonthYear, formatShortDate, today } from './dates';
import { formatMoney, fractionDigits } from './money';
import { METHOD_LABELS } from './summaries';

const escape = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

async function share(uri: string, mimeType: string, title: string) {
  if (!(await Sharing.isAvailableAsync())) {
    Alert.alert('Sharing isn’t available', 'This phone can’t share files from Mentto.');
    return;
  }
  await Sharing.shareAsync(uri, { mimeType, dialogTitle: title, UTI: mimeType === 'application/pdf' ? 'com.adobe.pdf' : 'public.comma-separated-values-text' });
}

// ── PDF (Pro) ─────────────────────────────────────────────────────────────────

const PAGE_CSS = `
  @page { margin: 36px; }
  body { font-family: -apple-system, Roboto, 'Helvetica Neue', Arial, sans-serif; color: #15151F; font-size: 13px; }
  .brand { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #4F46E5; padding-bottom: 14px; margin-bottom: 22px; }
  .brand h1 { font-size: 24px; margin: 0; color: #4F46E5; letter-spacing: -0.3px; }
  .brand .tutor { text-align: right; color: #5B5B70; }
  .brand .tutor strong { color: #15151F; font-size: 15px; display: block; }
  h2 { font-size: 15px; margin: 22px 0 8px; }
  table { width: 100%; border-collapse: collapse; }
  td, th { padding: 8px 6px; text-align: left; border-bottom: 1px solid #E2E2EB; }
  th { color: #5B5B70; font-weight: 600; font-size: 12px; }
  .num { text-align: right; font-variant-numeric: tabular-nums; }
  .total td { font-weight: 700; border-bottom: none; border-top: 2px solid #15151F; }
  .big { font-size: 28px; font-weight: 700; margin: 4px 0 0; }
  .muted { color: #86869B; }
  .foot { margin-top: 36px; color: #86869B; font-size: 11px; }
`;

function page(title: string, tutor: string, body: string) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>${PAGE_CSS}</style></head><body>
    <div class="brand"><h1>${escape(title)}</h1>
      <div class="tutor">${tutor ? `<strong>${escape(tutor)}</strong>` : ''}Issued ${escape(formatFullDate(today()))}</div></div>
    ${body}
    <div class="foot">Made with Mentto</div></body></html>`;
}

async function sharePdf(html: string, name: string, title: string) {
  const { uri } = await Print.printToFileAsync({ html, width: 595, height: 842 });
  // Give the file a readable name before sharing (the printer picks a random one).
  const named = new File(Paths.cache, `${name}.pdf`);
  if (named.exists) named.delete();
  new File(uri).move(named);
  await share(named.uri, 'application/pdf', title);
}

const fileSafe = (s: string) => s.replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-');

export async function shareReceiptPdf(student: Student, payment: Payment, tutor: string) {
  const body = `
    <p class="muted">Received from</p>
    <p style="font-size:17px;font-weight:600;margin:2px 0 16px">${escape(student.name)}</p>
    <table>
      <tr><th>Date</th><td>${escape(formatFullDate(payment.paidOn))}</td></tr>
      <tr><th>Paid by</th><td>${escape(payment.method ? METHOD_LABELS[payment.method] : '—')}</td></tr>
      ${payment.note ? `<tr><th>Note</th><td>${escape(payment.note)}</td></tr>` : ''}
    </table>
    <p class="muted" style="margin-top:22px">Amount received</p>
    <p class="big">${escape(formatMoney(payment.amount, payment.currency))}</p>
    <p style="margin-top:26px">Thank you!</p>`;
  await sharePdf(page('Receipt', tutor, body), `Receipt-${fileSafe(student.name)}-${payment.paidOn}`, 'Send receipt');
}

/** A month's statement: what was charged, what was paid, and the balance carried. */
export async function shareStatementPdf(db: DB, student: Student, fee: FeeStatus, month: string, tutor: string) {
  const end = `${month}-31`;
  const [payments, attended, allPlans] = await Promise.all([
    listPayments(db, student.id, -1),
    listAttendedSessions(db, student.id),
    listPlans(db, student.id),
  ]);
  const charges = chargesFor(allPlans, attended, end < today() ? end : today());
  const inMonth = <T extends { date: string }>(rows: T[]) => rows.filter((r) => r.date.startsWith(month));
  const before = <T extends { date: string }>(rows: T[]) => rows.filter((r) => r.date < `${month}-01`);

  const pays = payments.map((p) => ({ date: p.paidOn, amount: p.amount, method: p.method }));
  const opening =
    before(charges).reduce((s, c) => s + c.amount, 0) - before(pays).reduce((s, p) => s + p.amount, 0);
  const rows = [
    ...inMonth(charges).map((c) => ({ date: c.date, what: fee.plan?.kind === 'per_session' ? 'Lesson' : 'Fee', charge: c.amount, paid: 0 })),
    ...inMonth(pays).map((p) => ({ date: p.date, what: `Payment${p.method ? ` (${METHOD_LABELS[p.method]})` : ''}`, charge: 0, paid: p.amount })),
  ].sort((a, b) => a.date.localeCompare(b.date));
  const closing = opening + rows.reduce((s, r) => s + r.charge - r.paid, 0);
  const m = (v: number) => (v ? escape(formatMoney(v, fee.currency)) : '');

  const body = `
    <p class="muted">Statement for</p>
    <p style="font-size:17px;font-weight:600;margin:2px 0 4px">${escape(student.name)}</p>
    <p class="muted">${escape(formatMonthYear(`${month}-01`))}</p>
    <h2>Activity</h2>
    <table>
      <tr><th>Date</th><th>Description</th><th class="num">Charged</th><th class="num">Paid</th></tr>
      <tr><td></td><td class="muted">Balance brought forward</td><td class="num" colspan="2">${escape(formatMoney(opening, fee.currency))}</td></tr>
      ${rows.map((r) => `<tr><td>${escape(formatShortDate(r.date))}</td><td>${escape(r.what)}</td><td class="num">${m(r.charge)}</td><td class="num">${m(r.paid)}</td></tr>`).join('')}
      <tr class="total"><td></td><td>${closing > 0 ? 'Balance due' : closing < 0 ? 'In credit' : 'Balance'}</td><td class="num" colspan="2">${escape(formatMoney(Math.abs(closing), fee.currency))}</td></tr>
    </table>`;
  await sharePdf(page('Statement', tutor, body), `Statement-${fileSafe(student.name)}-${month}`, 'Send statement');
}

// ── CSV export (free) ───────────────────────────────────────────────────────────

const cell = (v: unknown) => {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const toCsv = (header: string[], rows: unknown[][]) =>
  [header, ...rows].map((r) => r.map(cell).join(',')).join('\n') + '\n';

async function shareCsv(name: string, csv: string, title: string) {
  const file = new File(Paths.cache, `${name}-${today()}.csv`);
  if (file.exists) file.delete();
  file.create();
  file.write('﻿' + csv); // BOM so spreadsheet apps read accented names correctly
  await share(file.uri, 'text/csv', title);
}

const major = (minor: number, currency: string) => {
  const digits = fractionDigits(currency);
  return (minor / 10 ** digits).toFixed(digits);
};

export type ExportKind = 'students' | 'payments' | 'attendance';

export async function exportCsv(db: DB, kind: ExportKind) {
  if (kind === 'students') {
    const rows = await db.getAllAsync<Record<string, string | null>>(
      'SELECT name, phone, email, guardian_name, guardian_phone, notes, status FROM students ORDER BY name COLLATE NOCASE',
    );
    await shareCsv(
      'mentto-students',
      toCsv(['Name', 'Phone', 'Email', 'Parent or guardian', 'Guardian phone', 'Notes', 'Status'],
        rows.map((r) => [r.name, r.phone, r.email, r.guardian_name, r.guardian_phone, r.notes, r.status])),
      'Export students',
    );
  } else if (kind === 'payments') {
    const rows = await db.getAllAsync<{ name: string; paid_on: string; amount: number; currency: string; method: string | null; note: string | null }>(
      `SELECT st.name, p.paid_on, p.amount, p.currency, p.method, p.note FROM payments p
       JOIN students st ON st.id = p.student_id ORDER BY p.paid_on DESC`,
    );
    await shareCsv(
      'mentto-payments',
      toCsv(['Date', 'Student', 'Amount', 'Currency', 'Method', 'Note'],
        rows.map((r) => [r.paid_on, r.name, major(r.amount, r.currency), r.currency, r.method ? METHOD_LABELS[r.method] : '', r.note])),
      'Export payments',
    );
  } else {
    const rows = await db.getAllAsync<{ name: string; starts_at: string; duration_min: number; status: string; group_name: string | null }>(
      `SELECT st.name, se.starts_at, se.duration_min, se.status, g.name AS group_name FROM sessions se
       JOIN students st ON st.id = se.student_id
       LEFT JOIN schedules sc ON sc.id = se.schedule_id LEFT JOIN groups g ON g.id = sc.group_id
       ORDER BY se.starts_at DESC`,
    );
    await shareCsv(
      'mentto-attendance',
      toCsv(['Date', 'Time', 'Student', 'Group', 'Minutes', 'Attendance'],
        rows.map((r) => [r.starts_at.slice(0, 10), r.starts_at.slice(11, 16), r.name, r.group_name, r.duration_min, r.status])),
      'Export attendance',
    );
  }
}
