import { StyleSheet } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { radii, spacing, useTheme } from '@/theme';

import { Icon, type IconName } from './Icon';
import { PressableScale } from './PressableScale';
import { Text } from './Text';

type Props = {
  icon: IconName;
  label: string;
  onPress: () => void;
};

/** Extended floating action button for a screen's main "add" action. */
export function Fab({ icon, label, onPress }: Props) {
  const { colors } = useTheme();
  return (
    <Animated.View entering={FadeIn.duration(200)} style={styles.wrap} pointerEvents="box-none">
      <PressableScale
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={label}
        style={[styles.fab, { backgroundColor: colors.primary, shadowColor: colors.primary }]}
      >
        <Icon name={icon} tint={colors.onPrimary} />
        <Text variant="bodyStrong" color="onPrimary">
          {label}
        </Text>
      </PressableScale>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    right: spacing.md,
    bottom: spacing.md,
  },
  fab: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.lg,
    elevation: 4,
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
});
