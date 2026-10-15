import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { radii, spacing, useTheme } from '@/theme';

import { Icon, type IconName } from './Icon';
import { Text } from './Text';

type Message = {
  id: number;
  text: string;
  icon?: IconName;
  action?: { label: string; onPress: () => void };
};

type Show = (text: string, options?: { icon?: IconName; action?: Message['action'] }) => void;

const SnackbarContext = createContext<Show>(() => {});

export const useSnackbar = () => useContext(SnackbarContext);

const DURATION_MS = 3200;
const WITH_ACTION_MS = 5500;

/** Brief confirmation at the bottom of the screen, e.g. "Payment recorded". */
export function SnackbarProvider({ children }: { children: ReactNode }) {
  const { colors, dark } = useTheme();
  const insets = useSafeAreaInsets();
  const [message, setMessage] = useState<Message | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const nextId = useRef(0);

  const show = useCallback<Show>((text, options) => {
    clearTimeout(timer.current);
    nextId.current += 1;
    setMessage({ id: nextId.current, text, ...options });
    AccessibilityInfo.announceForAccessibility(text);
    timer.current = setTimeout(() => setMessage(null), options?.action ? WITH_ACTION_MS : DURATION_MS);
  }, []);

  useEffect(() => () => clearTimeout(timer.current), []);

  // Inverted surface so it stands apart from the page in both themes.
  const bg = dark ? colors.text : '#1E1E2A';
  const fg = dark ? colors.background : '#F2F2F8';
  const actionColor = dark ? colors.onPrimarySoft : '#B9BCFF';

  return (
    <SnackbarContext.Provider value={show}>
      {children}
      {message && (
        <View pointerEvents="box-none" style={[styles.host, { bottom: insets.bottom + 88 }]}>
          <Animated.View
            key={message.id}
            entering={FadeInDown.duration(220)}
            exiting={FadeOutDown.duration(180)}
            style={[styles.bar, { backgroundColor: bg }]}
            accessibilityLiveRegion="polite"
          >
            {message.icon && <Icon name={message.icon} size={20} tint={fg} />}
            <Text variant="label" style={[styles.text, { color: fg }]} numberOfLines={2}>
              {message.text}
            </Text>
            {message.action && (
              <Pressable
                onPress={() => {
                  message.action?.onPress();
                  setMessage(null);
                }}
                accessibilityRole="button"
                hitSlop={8}
              >
                <Text variant="labelStrong" style={{ color: actionColor }}>
                  {message.action.label}
                </Text>
              </Pressable>
            )}
          </Animated.View>
        </View>
      )}
    </SnackbarContext.Provider>
  );
}

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
  },
  bar: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    elevation: 6,
  },
  text: {
    flex: 1,
  },
});
