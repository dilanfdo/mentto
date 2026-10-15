import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { radii, sizes, spacing, useTheme, type ColorTokens } from '@/theme';

import { Icon, type IconName } from './Icon';
import { PressableScale } from './PressableScale';
import { Text } from './Text';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

type Props = {
  label: string;
  /** May return a promise; the button shows a spinner and ignores taps until it settles. */
  onPress: () => unknown;
  variant?: Variant;
  icon?: IconName;
  size?: 'regular' | 'small';
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
};

const palette: Record<Variant, { bg: keyof ColorTokens; fg: keyof ColorTokens; border?: keyof ColorTokens }> = {
  primary: { bg: 'primary', fg: 'onPrimary' },
  secondary: { bg: 'surface', fg: 'text', border: 'borderStrong' },
  ghost: { bg: 'background', fg: 'primary' },
  danger: { bg: 'dangerSoft', fg: 'onDangerSoft' },
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  icon,
  size = 'regular',
  disabled,
  loading,
  fullWidth,
  accessibilityHint,
  style,
}: Props) {
  const { colors } = useTheme();
  const [busy, setBusy] = useState(false);
  const p = palette[variant];
  const isBusy = loading || busy;
  const inactive = disabled || isBusy;

  const handlePress = async () => {
    if (inactive) return;
    if (variant === 'primary') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    const result = onPress();
    if (result instanceof Promise) {
      setBusy(true);
      try {
        await result;
      } finally {
        setBusy(false);
      }
    }
  };

  return (
    <PressableScale
      onPress={handlePress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!disabled, busy: isBusy }}
      style={[
        styles.base,
        {
          minHeight: size === 'small' ? sizes.buttonSmall : sizes.button,
          paddingHorizontal: size === 'small' ? spacing.md : spacing.lg,
          backgroundColor: variant === 'ghost' ? 'transparent' : colors[p.bg],
          borderColor: p.border ? colors[p.border] : 'transparent',
          opacity: disabled ? 0.45 : 1,
        },
        fullWidth && styles.fullWidth,
        style,
      ]}
    >
      {isBusy ? (
        <ActivityIndicator color={colors[p.fg]} />
      ) : (
        <View style={styles.content}>
          {icon && <Icon name={icon} size={size === 'small' ? 18 : 20} tint={colors[p.fg]} />}
          <Text variant={size === 'small' ? 'labelStrong' : 'bodyStrong'} color={p.fg} numberOfLines={1}>
            {label}
          </Text>
        </View>
      )}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radii.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullWidth: {
    alignSelf: 'stretch',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
});
