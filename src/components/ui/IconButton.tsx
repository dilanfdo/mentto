import { Pressable, StyleSheet } from 'react-native';

import { radii, sizes, useTheme, type ColorTokens } from '@/theme';

import { Icon, type IconName } from './Icon';

type Props = {
  icon: IconName;
  /** Read by screen readers; icon buttons have no visible text. */
  label: string;
  onPress: () => void;
  color?: keyof ColorTokens;
  filled?: boolean;
  disabled?: boolean;
};

export function IconButton({ icon, label, onPress, color = 'text', filled, disabled }: Props) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      android_ripple={{ color: colors.ripple, borderless: true, radius: sizes.touch / 2 }}
      hitSlop={4}
      style={[
        styles.base,
        filled && { backgroundColor: colors.surfaceMuted },
        disabled && { opacity: 0.4 },
      ]}
    >
      <Icon name={icon} color={color} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    width: sizes.touch,
    height: sizes.touch,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
