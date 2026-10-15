import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { spacing, useTheme } from '@/theme';

import { Text } from './Text';

type Props = {
  title: string;
  action?: { label: string; onPress: () => void };
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
};

/** A titled group of content with an optional text action on the right. */
export function Section({ title, action, children, style }: Props) {
  const { colors } = useTheme();
  return (
    <View style={[styles.section, style]}>
      <View style={styles.header}>
        <Text variant="headline" accessibilityRole="header">
          {title}
        </Text>
        {action && (
          <Pressable
            onPress={action.onPress}
            accessibilityRole="button"
            hitSlop={12}
            android_ripple={{ color: colors.ripple, borderless: true }}
          >
            <Text variant="labelStrong" color="primary">
              {action.label}
            </Text>
          </Pressable>
        )}
      </View>
      {children}
    </View>
  );
}

export function Divider({ inset = 0 }: { inset?: number }) {
  const { colors } = useTheme();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginLeft: inset }} />;
}

const styles = StyleSheet.create({
  section: {
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 32,
  },
});
