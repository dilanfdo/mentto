#!/usr/bin/env node
// Builds a demo database for store screenshots: a tutor with ten students, a group class, two
// months of attendance and payments, all dated relative to today so the app looks lived-in.
//
//   node store/seed_demo.mjs [out.db] [USD|LKR]      (Node 22+, uses the built-in node:sqlite)
//
// Amounts below are written in US cents; LKR uses the same figures as whole rupees
// ($120 a month becomes LKR 12,000), which matches typical private tuition fees in Sri Lanka.
//
// Then copy it into the debug app (see store/README.md).
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const out = process.argv[2] ?? path.join(root, 'store', 'demo.db');
const CURRENCY = (process.argv[3] ?? 'USD').toUpperCase();
const SCALE = CURRENCY === 'LKR' ? 100 : 1; // minor units: $120.00 = 12000, LKR 12,000.00 = 1200000
const phone = (n) => (CURRENCY === 'LKR' ? `+94 77 555 ${n}` : `+1 415 555 ${n}`);

// Run the app's own migrations so the schema is exactly what the app expects.
const schema = fs.readFileSync(path.join(root, 'src', 'db', 'schema.ts'), 'utf8');
const block = schema.slice(schema.indexOf('const MIGRATIONS'), schema.indexOf('];', schema.indexOf('const MIGRATIONS')));
const migrations = [...block.matchAll(/`([\s\S]*?)`/g)].map((m) => m[1]);

fs.rmSync(out, { force: true });
const db = new DatabaseSync(out);
for (const m of migrations) db.exec(m);
db.exec(`PRAGMA user_version = ${migrations.length}`);

// ── dates ────────────────────────────────────────────────────────────────────
const pad = (n) => String(n).padStart(2, '0');
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const today = new Date();
today.setHours(0, 0, 0, 0);
const day = (offset) => {
  const d = new Date(today);
  d.setDate(d.getDate() + offset);
  return iso(d);
};
const T = iso(today);
const monthDay = (monthsBack, dom) => iso(new Date(today.getFullYear(), today.getMonth() - monthsBack, dom));
const now = new Date().toISOString();
let seq = 0;
const id = (p) => `${p}-${++seq}`;

const CODES = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
const weekday = (d) => new Date(`${d}T00:00`).getDay();
const rrule = (days) => `FREQ=WEEKLY;INTERVAL=1;BYDAY=${days.map((d) => CODES[d]).join(',')}`;

// ── people ───────────────────────────────────────────────────────────────────
const students = {};
const addStudent = (key, name, extra = {}) => {
  students[key] = id('st');
  db.prepare(
    `INSERT INTO students (id, name, phone, email, guardian_name, guardian_phone, notes, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    students[key],
    name,
    extra.phone ?? null,
    extra.email ?? null,
    extra.guardian ?? null,
    extra.guardianPhone ?? null,
    extra.notes ?? null,
    extra.status ?? 'active',
    now,
    now,
  );
};

addStudent('amaya', 'Amaya Silva', { phone: phone('0142'), notes: 'Grade 6 vocals. Working on breath support.' });
addStudent('ravi', 'Ravi Kumar', { phone: phone('0171'), guardian: 'Priya Kumar', guardianPhone: phone('0172') });
addStudent('lea', 'Léa Martin', { phone: phone('0119'), email: 'lea.martin@example.com' });
addStudent('kavindu', 'Kavindu Jayasinghe', { guardian: 'Dilini Jayasinghe', guardianPhone: phone('0133') });
addStudent('nila', 'Nila Perera', { guardian: 'Ruwan Perera', guardianPhone: phone('0158') });
addStudent('arjun', 'Arjun Mehta', { phone: phone('0186') });
addStudent('sofia', 'Sofia Rossi', { phone: phone('0127') });
addStudent('daniel', 'Daniel Okafor', { phone: phone('0164') });
addStudent('mei', 'Mei Tanaka', { phone: phone('0191'), email: 'mei.t@example.com' });
addStudent('hannah', 'Hannah Weber', { phone: phone('0105') });
addStudent('tom', 'Tom Becker', { status: 'archived' });

const groupId = id('gr');
db.prepare(`INSERT INTO groups (id, name, notes, status, created_at, updated_at) VALUES (?, ?, ?, 'active', ?, ?)`).run(
  groupId,
  'Grade 5 theory',
  'ABRSM Grade 5 theory. Exam in March.',
  now,
  now,
);
for (const k of ['kavindu', 'nila', 'arjun', 'sofia']) {
  db.prepare('INSERT INTO group_members (group_id, student_id, added_on) VALUES (?, ?, ?)').run(groupId, students[k], day(-70));
}

// ── lessons ──────────────────────────────────────────────────────────────────
const slots = [];
const addSlot = (owner, days, time, minutes, startsOn, location = null) => {
  const s = { id: id('sc'), owner, days, time, minutes, startsOn, location };
  db.prepare(
    `INSERT INTO schedules (id, student_id, group_id, rrule, start_time, duration_min, starts_on, ends_on, location, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?)`,
  ).run(s.id, owner.student ?? null, owner.group ?? null, rrule(days), time, minutes, startsOn, location, now, now);
  slots.push(s);
  return s;
};

const start = day(-63);
addSlot({ student: students.amaya }, [1, 3], '09:00', 45, start, 'Studio');
addSlot({ student: students.ravi }, [1], '11:00', 60, start, 'Studio');
addSlot({ student: students.lea }, [1, 4], '12:30', 45, start, 'Online');
const theory = addSlot({ group: groupId }, [1, 4], '16:00', 60, start, 'Community hall');
addSlot({ student: students.hannah }, [1], '18:00', 45, start, 'Studio');
const danielSlot = addSlot({ student: students.daniel }, [2, 5], '17:00', 45, start, 'Studio');
const meiSlot = addSlot({ student: students.mei }, [3], '15:00', 60, start, 'Online');

// An extra one-off lesson later this week.
db.prepare(
  `INSERT INTO schedules (id, student_id, group_id, rrule, start_time, duration_min, starts_on, ends_on, location, created_at, updated_at)
   VALUES (?, ?, NULL, 'FREQ=ONCE', '10:00', 60, ?, ?, 'Studio', ?, ?)`,
).run(id('sc'), students.amaya, day(3), day(3), now, now);

// This week: Daniel's Friday lesson moved to Saturday morning; Mei's Wednesday lesson cancelled.
const nextDow = (dow) => day(((dow - today.getDay() + 7) % 7) || 7);
db.prepare(`INSERT INTO schedule_exceptions VALUES (?, ?, ?, 'moved', ?, ?)`).run(
  id('ex'),
  danielSlot.id,
  nextDow(5),
  `${nextDow(6)}T10:00`,
  now,
);
db.prepare(`INSERT INTO schedule_exceptions VALUES (?, ?, ?, 'cancelled', NULL, ?)`).run(id('ex'), meiSlot.id, nextDow(3), now);

// Attendance for every past lesson, with a few misses, plus this morning's lessons.
const members = { [groupId]: ['kavindu', 'nila', 'arjun', 'sofia'].map((k) => students[k]) };
const insertSession = db.prepare(
  `INSERT INTO sessions (id, student_id, schedule_id, starts_at, duration_min, status, notes, created_at, updated_at)
   VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?)`,
);
let n = 0;
for (let offset = -63; offset <= 0; offset += 1) {
  const d = day(offset);
  for (const s of slots) {
    if (!s.days.includes(weekday(d)) || d < s.startsOn) continue;
    if (offset === 0 && s.time >= '12:00') continue; // the afternoon hasn't happened yet
    const people = s.owner.group ? members[s.owner.group] : [s.owner.student];
    for (const p of people) {
      n += 1;
      // A few misses in the history; today's lessons all went ahead.
      const status = n % 11 === 0 && offset < 0 ? 'missed' : 'attended';
      insertSession.run(id('se'), p, s.id, `${d}T${s.time}`, s.minutes, status, now, now);
    }
  }
}

// ── fees ─────────────────────────────────────────────────────────────────────
const addPlan = (key, kind, amount, startsOn, periodMonths = kind === 'monthly' ? 1 : null) => {
  const dueDay = kind === 'per_session' ? null : Math.min(Number(startsOn.slice(8, 10)), 28);
  db.prepare(
    `INSERT INTO fee_plans (id, student_id, kind, amount, currency, due_day, period_months, starts_on, ends_on, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)`,
  ).run(id('fp'), students[key], kind, amount * SCALE, CURRENCY, dueDay, periodMonths, startsOn, now, now);
};
const pay = (key, amount, paidOn, method = 'bank', note = null) => {
  db.prepare(
    `INSERT INTO payments (id, student_id, amount, currency, paid_on, period, method, note, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, NULL, ?, ?, ?, ?)`,
  ).run(id('pa'), students[key], amount * SCALE, CURRENCY, paidOn, method, note, now, now);
};

addPlan('amaya', 'monthly', 12000, monthDay(2, 5));
pay('amaya', 12000, monthDay(2, 4)); pay('amaya', 12000, monthDay(1, 5)); pay('amaya', 12000, monthDay(0, 3), 'cash');

addPlan('ravi', 'per_session', 3500, day(-63));
pay('ravi', 17500, monthDay(1, 28)); pay('ravi', 10500, day(-6), 'cash'); // leaves two lessons owing

addPlan('lea', 'monthly', 14000, monthDay(1, 1));
pay('lea', 14000, monthDay(1, 2), 'card'); // October unpaid

addPlan('kavindu', 'monthly', 9000, monthDay(2, 10));
pay('kavindu', 9000, monthDay(2, 10)); pay('kavindu', 9000, monthDay(1, 9)); pay('kavindu', 9000, monthDay(0, 10));
addPlan('nila', 'monthly', 9000, monthDay(2, 10));
pay('nila', 9000, monthDay(2, 12)); pay('nila', 9000, monthDay(1, 11)); // this month owing
addPlan('arjun', 'monthly', 9000, monthDay(2, 10));
pay('arjun', 9000, monthDay(2, 10)); pay('arjun', 9000, monthDay(1, 10)); pay('arjun', 9000, monthDay(0, 8), 'cash');
addPlan('sofia', 'term', 25000, monthDay(1, 10), 3);
pay('sofia', 25000, monthDay(1, 10));

addPlan('daniel', 'monthly', 10000, monthDay(2, Number(day(1).slice(8, 10)))); // falls due tomorrow
pay('daniel', 10000, monthDay(2, 20)); pay('daniel', 10000, monthDay(1, 20));
addPlan('mei', 'term', 36000, monthDay(1, 15), 3);
pay('mei', 36000, monthDay(1, 14));
addPlan('hannah', 'monthly', 11000, monthDay(2, Number(T.slice(8, 10)))); // falls due today
pay('hannah', 11000, monthDay(2, 19)); pay('hannah', 11000, monthDay(1, 19));

// ── settings ─────────────────────────────────────────────────────────────────
const meta = { onboarded: '1', tutor_name: 'Nadia Fernandes', currency: CURRENCY, lesson_reminder_min: '30', fee_reminders: '1', exact_hint_dismissed: '1', change_seq: '1' };
for (const [k, v] of Object.entries(meta)) db.prepare('INSERT INTO meta (key, value) VALUES (?, ?)').run(k, v);

db.close();
console.log(`wrote ${path.relative(process.cwd(), out)} in ${CURRENCY} for ${T} (${Object.keys(students).length} students, ${n} attendance marks)`);
