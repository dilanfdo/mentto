import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { spacing, useTheme } from '@/theme';

import { Icon, type IconName } from './Icon';
import { Text } from './Text';

type Props = {
  icon: IconName;
  title: string;
  message?: string;
  action?: ReactNode;
  compact?: boolean;
};

export function EmptyState({ icon, title, message, action, compact }: Props) {
  const { colors } = useTheme();
  return (
    <Animated.View entering={FadeIn.duration(240)} style={[styles.container, compact && styles.compact]}>
      <View style={[styles.iconWell, { backgroundColor: colors.primarySoft }, compact && styles.iconWellCompact]}>
        <Icon name={icon} size={compact ? 22 : 28} color="onPrimarySoft" />
      </View>
      <View style={styles.text}>
        <Text variant={compact ? 'bodyStrong' : 'headline'} align="center">
          {title}
        </Text>
        {message && (
          <Text variant={compact ? 'label' : 'body'} color="textSecondary" align="center">
            {message}
          </Text>
        )}
      </View>
      {action}
    </Animated.View>
  );
}

type ErrorProps = { message?: string; retry?: ReactNode };

export function ErrorState({ message, retry }: ErrorProps) {
  return (
    <EmptyState
      icon="alert-circle-outline"
      title="Something went wrong"
      message={message ?? 'Mentto couldn’t load this. Your data is safe on this phone.'}
      action={retry}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.lg,
  },
  compact: {
    paddingVertical: spacing.lg,
    gap: spacing.sm,
  },
  iconWell: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWellCompact: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  text: {
    gap: spacing.xxs,
    maxWidth: 320,
  },
});
