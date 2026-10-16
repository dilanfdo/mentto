import { today } from '@/lib/dates';

import { newId, timestamp, write, type DB } from './core';

export type GroupStatus = 'active' | 'archived';

export type Group = {
  id: string;
  name: string;
  notes: string | null;
  status: GroupStatus;
};

export type GroupMember = { id: string; name: string };

export type GroupWithMembers = Group & { members: GroupMember[] };

export type GroupInput = { name: string; notes: string | null; memberIds: string[] };

type GroupRow = { id: string; name: string; notes: string | null; status: GroupStatus };

const toGroup = (r: GroupRow): Group => ({ id: r.id, name: r.name, notes: r.notes, status: r.status });

/** Active students in each group, keyed by group id. Archived students drop out of their groups' lessons. */
export async function loadGroupMembers(db: DB, groupId?: string): Promise<Map<string, GroupMember[]>> {
  const rows = await db.getAllAsync<{ group_id: string; id: string; name: string }>(
    `SELECT gm.group_id, st.id, st.name FROM group_members gm
     JOIN students st ON st.id = gm.student_id
     WHERE st.status = 'active' ${groupId ? 'AND gm.group_id = ?' : ''}
     ORDER BY st.name COLLATE NOCASE`,
    ...(groupId ? [groupId] : []),
  );
  const map = new Map<string, GroupMember[]>();
  for (const r of rows) map.set(r.group_id, [...(map.get(r.group_id) ?? []), { id: r.id, name: r.name }]);
  return map;
}

export async function listGroups(db: DB, status: GroupStatus = 'active'): Promise<GroupWithMembers[]> {
  const [rows, members] = await Promise.all([
    db.getAllAsync<GroupRow>('SELECT * FROM groups WHERE status = ? ORDER BY name COLLATE NOCASE', status),
    loadGroupMembers(db),
  ]);
  return rows.map((r) => ({ ...toGroup(r), members: members.get(r.id) ?? [] }));
}

export async function getGroup(db: DB, id: string): Promise<GroupWithMembers | null> {
  const row = await db.getFirstAsync<GroupRow>('SELECT * FROM groups WHERE id = ?', id);
  if (!row) return null;
  const members = await loadGroupMembers(db, id);
  return { ...toGroup(row), members: members.get(id) ?? [] };
}

/** The active groups a student belongs to. */
export async function listStudentGroups(db: DB, studentId: string): Promise<Group[]> {
  const rows = await db.getAllAsync<GroupRow>(
    `SELECT g.* FROM groups g JOIN group_members gm ON gm.group_id = g.id
     WHERE gm.student_id = ? AND g.status = 'active' ORDER BY g.name COLLATE NOCASE`,
    studentId,
  );
  return rows.map(toGroup);
}

async function setMembers(db: DB, groupId: string, memberIds: string[]) {
  const current = await db.getAllAsync<{ student_id: string }>(
    'SELECT student_id FROM group_members WHERE group_id = ?',
    groupId,
  );
  const have = new Set(current.map((c) => c.student_id));
  const want = new Set(memberIds);
  for (const id of have) {
    if (!want.has(id)) {
      await db.runAsync('DELETE FROM group_members WHERE group_id = ? AND student_id = ?', groupId, id);
    }
  }
  for (const id of want) {
    if (!have.has(id)) {
      await db.runAsync(
        'INSERT INTO group_members (group_id, student_id, added_on) VALUES (?, ?, ?)',
        groupId,
        id,
        today(),
      );
    }
  }
}

export async function createGroup(db: DB, input: GroupInput): Promise<string> {
  const id = newId();
  const now = timestamp();
  await write(db, async () => {
    await db.runAsync(
      `INSERT INTO groups (id, name, notes, status, created_at, updated_at) VALUES (?, ?, ?, 'active', ?, ?)`,
      id,
      input.name.trim(),
      input.notes?.trim() || null,
      now,
      now,
    );
    await setMembers(db, id, input.memberIds);
  });
  return id;
}

export async function updateGroup(db: DB, id: string, input: GroupInput): Promise<void> {
  await write(db, async () => {
    await db.runAsync(
      'UPDATE groups SET name = ?, notes = ?, updated_at = ? WHERE id = ?',
      input.name.trim(),
      input.notes?.trim() || null,
      timestamp(),
      id,
    );
    await setMembers(db, id, input.memberIds);
  });
}

export async function setGroupStatus(db: DB, id: string, status: GroupStatus): Promise<void> {
  await write(db, async () => {
    await db.runAsync('UPDATE groups SET status = ?, updated_at = ? WHERE id = ?', status, timestamp(), id);
  });
}

/**
 * Removes the group and its slots. Members' attendance stays on their own records (sessions keep
 * the student) so per-lesson fees and history aren't lost.
 */
export async function deleteGroup(db: DB, id: string): Promise<void> {
  await write(db, async () => {
    await db.runAsync('DELETE FROM groups WHERE id = ?', id);
  });
}
