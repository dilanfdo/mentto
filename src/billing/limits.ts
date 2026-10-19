import type { DB } from '@/db/core';

/**
 * What the free version includes. Going over is never blocked retroactively: students and groups
 * that already exist keep working if Pro lapses; only adding more needs Pro.
 */
export const FREE_LIMITS = { students: 8, groups: 1 } as const;

export function overLimit(count: number, kind: keyof typeof FREE_LIMITS, isPro: boolean): boolean {
  return !isPro && count >= FREE_LIMITS[kind];
}

export async function countActive(db: DB): Promise<{ students: number; groups: number }> {
  const row = await db.getFirstAsync<{ students: number; groups: number }>(
    `SELECT (SELECT COUNT(*) FROM students WHERE status = 'active') AS students,
            (SELECT COUNT(*) FROM groups WHERE status = 'active') AS groups`,
  );
  return { students: row?.students ?? 0, groups: row?.groups ?? 0 };
}
