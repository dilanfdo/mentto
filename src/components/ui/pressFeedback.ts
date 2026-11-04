import { Platform, type PressableStateCallbackType, type StyleProp, type ViewStyle } from 'react-native';

/** iOS has no ripple, so pressed rows dim instead. Wraps a Pressable's style. */
export const withPressFeedback =
  (style: StyleProp<ViewStyle>) =>
  ({ pressed }: PressableStateCallbackType): StyleProp<ViewStyle> =>
    pressed && Platform.OS === 'ios' ? [style, { opacity: 0.6 }] : style;
