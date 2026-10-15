import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';

import { Placeholder } from '@/components/Placeholder';

export default function TodayScreen() {
  const db = useSQLiteContext();
  const [studentCount, setStudentCount] = useState<number | null>(null);

  useEffect(() => {
    db.getFirstAsync<{ count: number }>(
      "SELECT COUNT(*) AS count FROM students WHERE status = 'active'",
    ).then((row) => setStudentCount(row?.count ?? 0));
  }, [db]);

  return (
    <Placeholder
      title="Today"
      description={
        studentCount === null
          ? 'Loading…'
          : `Today's classes and fees due will show here. Active students: ${studentCount}`
      }
    />
  );
}
