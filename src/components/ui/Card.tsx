import { Pressable, StyleSheet, View, type StyleProp, type ViewProps, type ViewStyle } from 'react-native';

import { radii, spacing, useTheme } from '@/theme';

type Props = ViewProps & {
  onPress?: () => void;
  padded?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
};

/** A flat surface with a hairline border. Pressable when given onPress. */
export function Card({ onPress, padded = true, style, children, accessibilityLabel, ...rest }: Props) {
  const { colors } = useTheme();
  const cardStyle = [
    styles.card,
    padded && styles.padded,
    { backgroundColor: colors.surface, borderColor: colors.border },
    style,
  ];

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        android_ripple={{ color: colors.ripple }}
        style={cardStyle}
        {...rest}
      >
        {children}
      </Pressable>
    );
  }
  return (
    <View style={cardStyle} {...rest}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth * 2,
    overflow: 'hidden',
  },
  padded: {
    padding: spacing.md,
  },
});
