import { useEffect, useState, type ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { motion, radii, spacing, useTheme } from '@/theme';

import { Text } from './Text';

type Props = {
  visible: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: ReactNode;
};

/**
 * A bottom sheet for short, focused choices. Closes on the scrim, the Android back button, or a
 * selected action. Slides when motion is allowed, otherwise appears instantly.
 */
export function Sheet({ visible, onClose, title, subtitle, children }: Props) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const [mounted, setMounted] = useState(visible);
  const progress = useSharedValue(0);

  // Mount as soon as the sheet is asked to show; unmount only after the close animation.
  if (visible && !mounted) setMounted(true);

  useEffect(() => {
    if (visible) {
      progress.set(
        reduceMotion ? 1 : withTiming(1, { duration: motion.slow, easing: Easing.out(Easing.cubic) }),
      );
      return;
    }
    const done = () => setMounted(false);
    if (reduceMotion) {
      progress.set(0);
      const t = setTimeout(done, 0);
      return () => clearTimeout(t);
    }
    progress.set(
      withTiming(0, { duration: motion.base }, (finished) => {
        if (finished) runOnJS(done)();
      }),
    );
  }, [visible, reduceMotion, progress]);

  const scrimStyle = useAnimatedStyle(() => ({ opacity: progress.get() }));
  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: (1 - progress.get()) * 400 }],
    opacity: reduceMotion ? 1 : Math.min(1, progress.get() * 2),
  }));

  if (!mounted) return null;

  return (
    <Modal transparent visible statusBarTranslucent navigationBarTranslucent onRequestClose={onClose} animationType="none">
      <View style={styles.root}>
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: colors.scrim }, scrimStyle]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" accessibilityRole="button" />
        </Animated.View>
        <Animated.View
          accessibilityViewIsModal
          style={[
            styles.sheet,
            { backgroundColor: colors.surface, paddingBottom: insets.bottom + spacing.md },
            sheetStyle,
          ]}
        >
          <View style={[styles.handle, { backgroundColor: colors.borderStrong }]} />
          {(title || subtitle) && (
            <View style={styles.header}>
              {title && (
                <Text variant="title" accessibilityRole="header">
                  {title}
                </Text>
              )}
              {subtitle && (
                <Text variant="body" color="textSecondary">
                  {subtitle}
                </Text>
              )}
            </View>
          )}
          {children}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    paddingTop: spacing.xs,
    maxHeight: '88%',
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    marginBottom: spacing.sm,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    gap: spacing.xxs,
  },
});
