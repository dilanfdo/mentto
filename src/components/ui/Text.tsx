import { Text as RNText, type TextProps } from 'react-native';

import { typography, useTheme, type ColorTokens, type TypographyVariant } from '@/theme';

type Props = TextProps & {
  variant?: TypographyVariant;
  color?: keyof ColorTokens;
  align?: 'left' | 'center' | 'right';
};

/** All text in the app goes through here so type styles and font scaling stay consistent. */
export function Text({ variant = 'body', color = 'text', align, style, ...rest }: Props) {
  const { colors } = useTheme();
  return (
    <RNText
      maxFontSizeMultiplier={variant === 'display' || variant === 'amount' ? 1.4 : 1.8}
      style={[typography[variant], { color: colors[color] }, align && { textAlign: align }, style]}
      {...rest}
    />
  );
}
