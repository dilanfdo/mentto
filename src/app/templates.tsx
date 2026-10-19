import { Redirect, router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { usePro } from '@/billing/ProProvider';
import { Button, Card, Chip, Screen, SkeletonList, Text, TextField, useSnackbar } from '@/components/ui';
import { saveSettings, useSettings, type Settings } from '@/db/settings';
import { formatShortDate, today } from '@/lib/dates';
import { formatMoney } from '@/lib/money';
import { DEFAULT_TEMPLATES, fillTemplate, PLACEHOLDERS } from '@/lib/templates';
import { spacing } from '@/theme';

export default function TemplatesScreen() {
  const { isPro, ready } = usePro();
  const { data: settings } = useSettings();

  if (ready && !isPro) return <Redirect href={{ pathname: '/pro', params: { feature: 'templates' } }} />;
  if (!settings) {
    return (
      <Screen title="Message templates" back>
        <SkeletonList rows={4} />
      </Screen>
    );
  }
  return <TemplatesBody settings={settings} />;
}

function TemplateEditor({
  label,
  value,
  onChange,
  placeholders,
  preview,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholders: readonly string[];
  preview: string;
}) {
  return (
    <View style={styles.editor}>
      <TextField label={label} value={value} onChangeText={onChange} multiline />
      <View style={styles.chips}>
        {placeholders.map((p) => (
          <Chip key={p} label={p} selected={false} accessibilityLabel={`Insert ${p}`} onPress={() => onChange(`${value}${value.endsWith(' ') || !value ? '' : ' '}${p}`)} />
        ))}
      </View>
      <Card style={styles.preview}>
        <Text variant="caption" color="textTertiary">
          Preview
        </Text>
        <Text variant="body">{preview}</Text>
      </Card>
    </View>
  );
}

function TemplatesBody({ settings }: { settings: Settings }) {
  const db = useSQLiteContext();
  const snackbar = useSnackbar();
  const [reminder, setReminder] = useState(settings.feeReminderTemplate || DEFAULT_TEMPLATES.feeReminder);
  const [receipt, setReceipt] = useState(settings.receiptTemplate || DEFAULT_TEMPLATES.receipt);
  const tutor = settings.tutorName || 'Your name';
  const amount = formatMoney(1200000, settings.currency);

  const save = async () => {
    await saveSettings(db, {
      feeReminderTemplate: reminder.trim() === DEFAULT_TEMPLATES.feeReminder ? '' : reminder.trim(),
      receiptTemplate: receipt.trim() === DEFAULT_TEMPLATES.receipt ? '' : receipt.trim(),
    });
    router.back();
    snackbar('Templates saved', { icon: 'check-circle-outline' });
  };

  return (
    <Screen
      title="Message templates"
      back
      contentStyle={styles.content}
      footer={<Button label="Save templates" onPress={save} fullWidth />}
    >
      <Text variant="body" color="textSecondary">
        Used when you send a fee reminder or a receipt. Tap a placeholder to add it; Mentto fills it in for each student.
      </Text>
      <TemplateEditor
        label="Fee reminder"
        value={reminder}
        onChange={setReminder}
        placeholders={PLACEHOLDERS.feeReminder}
        preview={fillTemplate(reminder, { name: 'Amaya', amount, due: `was due on ${formatShortDate(today())}`, tutor })}
      />
      <TemplateEditor
        label="Receipt"
        value={receipt}
        onChange={setReceipt}
        placeholders={PLACEHOLDERS.receipt}
        preview={fillTemplate(receipt, { name: 'Amaya Silva', amount, date: formatShortDate(today()), method: 'Bank transfer', tutor })}
      />
      <Button
        label="Reset both to default"
        variant="ghost"
        onPress={() => {
          setReminder(DEFAULT_TEMPLATES.feeReminder);
          setReceipt(DEFAULT_TEMPLATES.receipt);
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.lg,
    paddingTop: spacing.xs,
  },
  editor: {
    gap: spacing.sm,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  preview: {
    gap: spacing.xxs,
  },
});
