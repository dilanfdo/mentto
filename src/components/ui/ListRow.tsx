import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { sizes, spacing, useTheme } from '@/theme';

import { Icon, type IconName } from './Icon';
import { Text } from './Text';

type Props = {
  title: string;
  subtitle?: string | null;
  leading?: ReactNode;
  leadingIcon?: IconName;
  trailing?: ReactNode;
  /** Shows a chevron, for rows that open another screen. */
  chevron?: boolean;
  onPress?: () => void;
  onLongPress?: () => void;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  dimmed?: boolean;
  destructive?: boolean;
};

export function ListRow({
  title,
  subtitle,
  leading,
  leadingIcon,
  trailing,
  chevron,
  onPress,
  onLongPress,
  accessibilityLabel,
  accessibilityHint,
  dimmed,
  destructive,
}: Props) {
  const { colors } = useTheme();
  const content = (
    <>
      {leading ??
        (leadingIcon && (
          <View style={[styles.iconWell, { backgroundColor: destructive ? colors.dangerSoft : colors.surfaceMuted }]}>
            <Icon name={leadingIcon} size={20} color={destructive ? 'danger' : 'textSecondary'} />
          </View>
        ))}
      <View style={styles.text}>
        <Text
          variant="bodyStrong"
          color={destructive ? 'danger' : dimmed ? 'textTertiary' : 'text'}
          numberOfLines={1}
          style={dimmed && styles.struck}
        >
          {title}
        </Text>
        {!!subtitle && (
          <Text variant="label" color="textSecondary" numberOfLines={2}>
            {subtitle}
          </Text>
        )}
      </View>
      {trailing}
      {chevron && <Icon name="chevron-right" size={20} color="textTertiary" />}
    </>
  );

  if (!onPress && !onLongPress) {
    return <View style={styles.row}>{content}</View>;
  }
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? [title, subtitle].filter(Boolean).join(', ')}
      accessibilityHint={accessibilityHint}
      android_ripple={{ color: colors.ripple }}
      style={styles.row}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: sizes.touch + spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  iconWell: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    flex: 1,
    gap: 2,
  },
  struck: {
    textDecorationLine: 'line-through',
  },
});
