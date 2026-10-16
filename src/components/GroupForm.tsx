import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import type { GroupInput } from '@/db/groups';
import type { Student } from '@/db/students';
import { spacing, useTheme } from '@/theme';

import { Avatar, Button, Card, Divider, Icon, Screen, Text, TextField } from './ui';

type Props = {
  title: string;
  submitLabel: string;
  students: Student[];
  initial?: GroupInput;
  onSubmit: (input: GroupInput) => Promise<void>;
  children?: ReactNode;
};

export function GroupForm({ title, submitLabel, students, initial, onSubmit, children }: Props) {
  const { colors } = useTheme();
  const [name, setName] = useState(initial?.name ?? '');
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [members, setMembers] = useState<string[]>(initial?.memberIds ?? []);
  const [error, setError] = useState<string | null>(null);

  const toggle = (id: string) =>
    setMembers((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));

  const submit = async () => {
    if (!name.trim()) {
      setError('Give the group a name');
      return;
    }
    await onSubmit({ name, notes, memberIds: members });
  };

  return (
    <Screen
      title={title}
      back
      backIcon="close"
      footer={<Button label={submitLabel} onPress={submit} fullWidth />}
      contentStyle={styles.content}
    >
      <TextField
        label="Group name"
        value={name}
        onChangeText={(t) => {
          setName(t);
          setError(null);
        }}
        error={error}
        placeholder="e.g. Grade 6 theory, Saturday choir"
        autoCapitalize="words"
        autoFocus={!initial}
      />

      <View style={styles.group}>
        <View style={styles.labelRow}>
          <Text variant="labelStrong" color="textSecondary">
            Students
          </Text>
          <Text variant="caption" color="textTertiary">
            {members.length} selected
          </Text>
        </View>
        {students.length === 0 ? (
          <Card>
            <Text variant="label" color="textSecondary">
              No students yet. You can create the group now and add students to it later.
            </Text>
          </Card>
        ) : (
          <Card padded={false}>
            {students.map((s, i) => {
              const selected = members.includes(s.id);
              return (
                <View key={s.id}>
                  {i > 0 && <Divider inset={68} />}
                  <Pressable
                    onPress={() => toggle(s.id)}
                    accessibilityRole="checkbox"
                    accessibilityLabel={s.name}
                    accessibilityState={{ checked: selected }}
                    android_ripple={{ color: colors.ripple }}
                    style={styles.row}
                  >
                    <Avatar name={s.name} size={40} />
                    <Text variant="bodyStrong" style={styles.flex} numberOfLines={1}>
                      {s.name}
                    </Text>
                    <Icon
                      name={selected ? 'checkbox-marked' : 'checkbox-blank-outline'}
                      color={selected ? 'primary' : 'textTertiary'}
                    />
                  </Pressable>
                </View>
              );
            })}
          </Card>
        )}
      </View>

      <TextField
        label="Notes"
        optional
        value={notes ?? ''}
        onChangeText={setNotes}
        placeholder="Syllabus, level, anything to remember"
        multiline
      />

      {children && <View style={styles.extra}>{children}</View>}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.lg,
    paddingTop: spacing.sm,
  },
  group: {
    gap: spacing.xs,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  row: {
    minHeight: 60,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  flex: {
    flex: 1,
  },
  extra: {
    gap: spacing.sm,
    marginTop: spacing.md,
  },
});
