import { router } from 'expo-router';
import type { ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  ScrollView,
  StyleSheet,
  View,
  type ScrollViewProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { spacing, useTheme } from '@/theme';

import { IconButton } from './IconButton';
import { Text } from './Text';

type AppBarProps = {
  title?: string;
  /** Show a back arrow. Defaults to router.back(). */
  back?: boolean | (() => void);
  backIcon?: 'arrow-left' | 'close';
  actions?: ReactNode;
};

export function AppBar({ title, back, backIcon = 'arrow-left', actions }: AppBarProps) {
  return (
    <View style={styles.appBar}>
      {back ? (
        <IconButton
          icon={backIcon}
          label={backIcon === 'close' ? 'Close' : 'Back'}
          onPress={typeof back === 'function' ? back : () => router.back()}
        />
      ) : (
        <View style={styles.appBarSpacer} />
      )}
      <Text variant="headline" numberOfLines={1} style={styles.appBarTitle} accessibilityRole="header">
        {title ?? ''}
      </Text>
      <View style={styles.actions}>{actions}</View>
    </View>
  );
}

type ScreenProps = AppBarProps & {
  children: ReactNode;
  /** A large page title shown at the top of the content (tab roots). */
  largeTitle?: string;
  subtitle?: string;
  /** Wrap content in a ScrollView. Turn off for screens that render their own list. */
  scroll?: boolean;
  /** Pinned to the bottom above the keyboard, e.g. a Save button. */
  footer?: ReactNode;
  /** Set on screens inside the tab bar, which already pads the bottom inset. */
  inTabs?: boolean;
  hideAppBar?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
  scrollProps?: ScrollViewProps;
};

export function Screen({
  children,
  largeTitle,
  subtitle,
  scroll = true,
  footer,
  inTabs,
  hideAppBar,
  contentStyle,
  scrollProps,
  ...appBar
}: ScreenProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const bottomPad = inTabs ? spacing.xl : Math.max(insets.bottom, spacing.md) + spacing.lg;

  const header = largeTitle ? (
    <View style={[styles.largeHeader, hideAppBar && styles.largeHeaderTop]}>
      <Text variant="display" accessibilityRole="header">
        {largeTitle}
      </Text>
      {subtitle && (
        <Text variant="body" color="textSecondary">
          {subtitle}
        </Text>
      )}
    </View>
  ) : null;

  return (
    <View style={[styles.root, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      {!hideAppBar && <AppBar {...appBar} />}
      <KeyboardAvoidingView style={styles.flex} behavior="padding">
        {scroll ? (
          <ScrollView
            style={styles.flex}
            contentContainerStyle={[
              styles.content,
              { paddingBottom: footer ? spacing.lg : bottomPad },
              contentStyle,
            ]}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            {...scrollProps}
          >
            {header}
            {children}
          </ScrollView>
        ) : (
          <View style={[styles.flex, contentStyle]}>
            {header && <View style={styles.headerPad}>{header}</View>}
            {children}
          </View>
        )}
        {footer && (
          <View
            style={[
              styles.footer,
              {
                backgroundColor: colors.background,
                borderTopColor: colors.border,
                paddingBottom: Math.max(insets.bottom, spacing.sm) + spacing.xs,
              },
            ]}
          >
            {footer}
          </View>
        )}
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  appBar: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.xxs,
    gap: spacing.xxs,
  },
  appBarSpacer: {
    width: spacing.sm,
  },
  appBarTitle: {
    flex: 1,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  largeHeader: {
    gap: spacing.xxs,
    marginBottom: spacing.lg,
  },
  largeHeaderTop: {
    paddingTop: spacing.lg,
  },
  headerPad: {
    paddingHorizontal: spacing.md,
  },
  content: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
  },
  footer: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
