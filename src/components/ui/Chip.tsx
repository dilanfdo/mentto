import * as Haptics from 'expo-haptics';
import { Pressable, StyleSheet, View } from 'react-native';

import { radii, spacing, useTheme } from '@/theme';

import { Icon } from './Icon';
import { Text } from './Text';

type ChipProps = {
  label: string;
  selected: boolean;
  onPress: () => void;
  accessibilityLabel?: string;
};

export function Chip({ label, selected, onPress, accessibilityLabel }: ChipProps) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={() => {
        Haptics.selectionAsync().catch(() => {});
        onPress();
      }}
      accessibilityRole="checkbox"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ checked: selected }}
      android_ripple={{ color: colors.ripple, borderless: false }}
      style={[
        styles.chip,
        {
          backgroundColor: selected ? colors.primarySoft : colors.surface,
          borderColor: selected ? colors.primary : colors.border,
        },
      ]}
    >
      {selected && <Icon name="check" size={16} color="onPrimarySoft" />}
      <Text variant="labelStrong" color={selected ? 'onPrimarySoft' : 'textSecondary'}>
        {label}
      </Text>
    </Pressable>
  );
}

type GroupProps<T extends string | number> = {
  options: { value: T; label: string; accessibilityLabel?: string }[];
  value: T | T[];
  onChange: (value: T) => void;
};

/** A wrapping row of chips. Pass an array as `value` for multi-select. */
export function ChipGroup<T extends string | number>({ options, value, onChange }: GroupProps<T>) {
  const isSelected = (v: T) => (Array.isArray(value) ? value.includes(v) : value === v);
  return (
    <View style={styles.group}>
      {options.map((o) => (
        <Chip
          key={String(o.value)}
          label={o.label}
          accessibilityLabel={o.accessibilityLabel}
          selected={isSelected(o.value)}
          onPress={() => onChange(o.value)}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxs,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    borderWidth: 1,
    overflow: 'hidden',
  },
  group: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
});
