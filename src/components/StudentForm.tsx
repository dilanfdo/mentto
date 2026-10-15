import { useRef, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import type { StudentInput } from '@/db/students';
import { spacing } from '@/theme';

import { Button, Icon, Screen, Text, TextField } from './ui';

type Props = {
  title: string;
  submitLabel: string;
  initial?: StudentInput;
  onSubmit: (input: StudentInput) => Promise<void>;
  /** Extra content under the fields, e.g. archive and delete on the edit screen. */
  children?: ReactNode;
};

const EMPTY: StudentInput = {
  name: '',
  phone: '',
  email: '',
  guardianName: '',
  guardianPhone: '',
  notes: '',
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function StudentForm({ title, submitLabel, initial, onSubmit, children }: Props) {
  const [values, setValues] = useState<StudentInput>({ ...EMPTY, ...initial });
  const [showGuardian, setShowGuardian] = useState(!!(initial?.guardianName || initial?.guardianPhone));
  const [errors, setErrors] = useState<{ name?: string; email?: string }>({});
  const phoneRef = useRef<TextInput>(null);
  const emailRef = useRef<TextInput>(null);

  const set = (key: keyof StudentInput) => (text: string) => {
    setValues((v) => ({ ...v, [key]: text }));
    if (key === 'name' || key === 'email') setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const submit = async () => {
    const next: typeof errors = {};
    if (!values.name.trim()) next.name = 'Enter the student’s name';
    if (values.email?.trim() && !EMAIL.test(values.email.trim())) next.email = 'That email doesn’t look right';
    setErrors(next);
    if (Object.keys(next).length) return;
    await onSubmit(values);
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
        label="Name"
        value={values.name}
        onChangeText={set('name')}
        error={errors.name}
        placeholder="Full name"
        autoCapitalize="words"
        autoFocus={!initial}
        returnKeyType="next"
        onSubmitEditing={() => phoneRef.current?.focus()}
        submitBehavior="submit"
      />
      <TextField
        ref={phoneRef}
        label="Phone"
        optional
        value={values.phone ?? ''}
        onChangeText={set('phone')}
        placeholder="For calls and reminders"
        keyboardType="phone-pad"
        autoComplete="tel"
        returnKeyType="next"
        onSubmitEditing={() => emailRef.current?.focus()}
        submitBehavior="submit"
      />
      <TextField
        ref={emailRef}
        label="Email"
        optional
        value={values.email ?? ''}
        onChangeText={set('email')}
        error={errors.email}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        autoCorrect={false}
      />

      {showGuardian ? (
        <Animated.View entering={FadeIn.duration(200)} style={styles.group}>
          <Text variant="headline">Parent or guardian</Text>
          <TextField
            label="Name"
            optional
            value={values.guardianName ?? ''}
            onChangeText={set('guardianName')}
            autoCapitalize="words"
          />
          <TextField
            label="Phone"
            optional
            value={values.guardianPhone ?? ''}
            onChangeText={set('guardianPhone')}
            keyboardType="phone-pad"
          />
        </Animated.View>
      ) : (
        <Pressable
          onPress={() => setShowGuardian(true)}
          accessibilityRole="button"
          style={styles.disclosure}
          hitSlop={8}
        >
          <Icon name="plus" size={20} color="primary" />
          <Text variant="bodyStrong" color="primary">
            Add parent or guardian
          </Text>
        </Pressable>
      )}

      <TextField
        label="Notes"
        optional
        value={values.notes ?? ''}
        onChangeText={set('notes')}
        placeholder="Level, goals, anything to remember"
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
    gap: spacing.md,
  },
  disclosure: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: 40,
  },
  extra: {
    gap: spacing.sm,
    marginTop: spacing.md,
  },
});
