import { newId, timestamp, write, type DB } from './core';

export type StudentStatus = 'active' | 'archived';

export type Student = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  guardianName: string | null;
  guardianPhone: string | null;
  notes: string | null;
  status: StudentStatus;
  createdAt: string;
};

export type StudentInput = Omit<Student, 'id' | 'status' | 'createdAt'>;

type Row = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  guardian_name: string | null;
  guardian_phone: string | null;
  notes: string | null;
  status: StudentStatus;
  created_at: string;
};

const toStudent = (r: Row): Student => ({
  id: r.id,
  name: r.name,
  phone: r.phone,
  email: r.email,
  guardianName: r.guardian_name,
  guardianPhone: r.guardian_phone,
  notes: r.notes,
  status: r.status,
  createdAt: r.created_at,
});

const blankToNull = (v: string | null) => (v && v.trim() ? v.trim() : null);

export async function listStudents(db: DB, status: StudentStatus = 'active'): Promise<Student[]> {
  const rows = await db.getAllAsync<Row>(
    'SELECT * FROM students WHERE status = ? ORDER BY name COLLATE NOCASE',
    status,
  );
  return rows.map(toStudent);
}

export async function getStudent(db: DB, id: string): Promise<Student | null> {
  const row = await db.getFirstAsync<Row>('SELECT * FROM students WHERE id = ?', id);
  return row ? toStudent(row) : null;
}

export async function countStudents(db: DB): Promise<{ active: number; archived: number }> {
  const row = await db.getFirstAsync<{ active: number; archived: number }>(
    `SELECT SUM(status = 'active') AS active, SUM(status = 'archived') AS archived FROM students`,
  );
  return { active: row?.active ?? 0, archived: row?.archived ?? 0 };
}

export async function createStudent(db: DB, input: StudentInput): Promise<string> {
  const id = newId();
  const now = timestamp();
  await write(db, async () => {
    await db.runAsync(
      `INSERT INTO students (id, name, phone, email, guardian_name, guardian_phone, notes, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)`,
      id,
      input.name.trim(),
      blankToNull(input.phone),
      blankToNull(input.email),
      blankToNull(input.guardianName),
      blankToNull(input.guardianPhone),
      blankToNull(input.notes),
      now,
      now,
    );
  });
  return id;
}

export async function updateStudent(db: DB, id: string, input: StudentInput): Promise<void> {
  await write(db, async () => {
    await db.runAsync(
      `UPDATE students SET name = ?, phone = ?, email = ?, guardian_name = ?, guardian_phone = ?, notes = ?, updated_at = ?
       WHERE id = ?`,
      input.name.trim(),
      blankToNull(input.phone),
      blankToNull(input.email),
      blankToNull(input.guardianName),
      blankToNull(input.guardianPhone),
      blankToNull(input.notes),
      timestamp(),
      id,
    );
  });
}

export async function setStudentStatus(db: DB, id: string, status: StudentStatus): Promise<void> {
  await write(db, async () => {
    await db.runAsync('UPDATE students SET status = ?, updated_at = ? WHERE id = ?', status, timestamp(), id);
  });
}

/** Removes the student and, through ON DELETE CASCADE, their slots, sessions, plans and payments. */
export async function deleteStudent(db: DB, id: string): Promise<void> {
  await write(db, async () => {
    await db.runAsync('DELETE FROM students WHERE id = ?', id);
  });
}
