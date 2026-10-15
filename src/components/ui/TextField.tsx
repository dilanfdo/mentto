import { forwardRef, useState } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { radii, sizes, spacing, typography, useTheme } from '@/theme';

import { Icon, type IconName } from './Icon';
import { Text } from './Text';

type Props = Omit<TextInputProps, 'style'> & {
  label: string;
  error?: string | null;
  hint?: string;
  optional?: boolean;
  leadingIcon?: IconName;
  /** Text shown inside the field before the value, e.g. a currency symbol. */
  prefix?: string;
};

export const TextField = forwardRef<TextInput, Props>(function TextField(
  { label, error, hint, optional, leadingIcon, prefix, multiline, onFocus, onBlur, ...rest },
  ref,
) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  const borderColor = error ? colors.danger : focused ? colors.primary : colors.border;

  return (
    <View style={styles.container}>
      <View style={styles.labelRow}>
        <Text variant="labelStrong" color="textSecondary">
          {label}
        </Text>
        {optional && (
          <Text variant="caption" color="textTertiary">
            Optional
          </Text>
        )}
      </View>
      <View
        style={[
          styles.field,
          multiline && styles.multiline,
          { borderColor, backgroundColor: colors.surface, borderWidth: focused || error ? 1.5 : 1 },
        ]}
      >
        {leadingIcon && <Icon name={leadingIcon} size={20} color="textTertiary" />}
        {prefix && (
          <Text variant="bodyStrong" color="textSecondary">
            {prefix}
          </Text>
        )}
        <TextInput
          ref={ref}
          accessibilityLabel={label}
          accessibilityHint={error ?? hint}
          placeholderTextColor={colors.textTertiary}
          selectionColor={colors.primary}
          cursorColor={colors.primary}
          multiline={multiline}
          textAlignVertical={multiline ? 'top' : 'center'}
          maxFontSizeMultiplier={1.8}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          style={[styles.input, typography.body, { color: colors.text }]}
          {...rest}
        />
      </View>
      {error ? (
        <View style={styles.message} accessibilityLiveRegion="polite">
          <Icon name="alert-circle-outline" size={16} color="danger" />
          <Text variant="caption" color="danger">
            {error}
          </Text>
        </View>
      ) : hint ? (
        <Text variant="caption" color="textTertiary" style={styles.message}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    gap: spacing.xs,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  field: {
    minHeight: sizes.input,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  multiline: {
    minHeight: 104,
    alignItems: 'flex-start',
    paddingVertical: spacing.sm,
  },
  input: {
    flex: 1,
    paddingVertical: spacing.sm,
    includeFontPadding: false,
  },
  message: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxs,
  },
});
