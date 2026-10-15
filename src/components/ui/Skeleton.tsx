import { useEffect } from 'react';
import { StyleSheet, View, type DimensionValue } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { radii, spacing, useTheme } from '@/theme';

type Props = { width?: DimensionValue; height?: number; radius?: number };

export function Skeleton({ width = '100%', height = 16, radius = radii.sm }: Props) {
  const { colors } = useTheme();
  const reduceMotion = useReducedMotion();
  const opacity = useSharedValue(0.5);

  useEffect(() => {
    if (!reduceMotion) opacity.set(withRepeat(withTiming(1, { duration: 700 }), -1, true));
  }, [opacity, reduceMotion]);

  const style = useAnimatedStyle(() => ({ opacity: opacity.get() }));
  return (
    <Animated.View
      accessibilityElementsHidden
      style={[{ width, height, borderRadius: radius, backgroundColor: colors.surfaceMuted }, style]}
    />
  );
}

/** Placeholder rows shown while a list loads. */
export function SkeletonList({ rows = 4 }: { rows?: number }) {
  return (
    <View style={styles.list} accessibilityLabel="Loading" accessibilityRole="progressbar">
      {Array.from({ length: rows }, (_, i) => (
        <View key={i} style={styles.row}>
          <Skeleton width={44} height={44} radius={22} />
          <View style={styles.lines}>
            <Skeleton width="55%" height={14} />
            <Skeleton width="35%" height={12} />
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  lines: {
    flex: 1,
    gap: spacing.xs,
  },
});
