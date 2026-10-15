import { StyleSheet, View } from 'react-native';

import { radii, spacing, useTheme, type ColorTokens } from '@/theme';

import { Icon, type IconName } from './Icon';
import { Text } from './Text';

export type Tone = 'neutral' | 'primary' | 'success' | 'warning' | 'danger';

const tones: Record<Tone, { bg: keyof ColorTokens; fg: keyof ColorTokens }> = {
  neutral: { bg: 'surfaceMuted', fg: 'textSecondary' },
  primary: { bg: 'primarySoft', fg: 'onPrimarySoft' },
  success: { bg: 'successSoft', fg: 'onSuccessSoft' },
  warning: { bg: 'warningSoft', fg: 'onWarningSoft' },
  danger: { bg: 'dangerSoft', fg: 'onDangerSoft' },
};

type Props = {
  label: string;
  tone?: Tone;
  /** Badges always pair color with an icon or words, never color alone. */
  icon?: IconName;
};

export function Badge({ label, tone = 'neutral', icon }: Props) {
  const { colors } = useTheme();
  const t = tones[tone];
  return (
    <View style={[styles.badge, { backgroundColor: colors[t.bg] }]}>
      {icon && <Icon name={icon} size={14} tint={colors[t.fg]} />}
      <Text variant="caption" color={t.fg} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: spacing.xxs,
    paddingHorizontal: spacing.xs,
    paddingVertical: 3,
    borderRadius: radii.pill,
  },
});
