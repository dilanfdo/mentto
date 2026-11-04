import { Platform, Text as RNText, type TextProps } from 'react-native';

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

const FIT_TITLE_CHARS = 13; // what fits a half-width tile at the title size

/**
 * One line at the title size that shrinks for long values, like big amounts. iOS scales by length,
 * because its adjustsFontSizeToFit collapses to a sliver in these auto-height tiles.
 */
export function FitTitle({ children }: { children: string }) {
  if (Platform.OS !== 'ios') {
    return (
      <Text variant="title" numberOfLines={1} adjustsFontSizeToFit>
        {children}
      </Text>
    );
  }
  const scale = Math.min(1, FIT_TITLE_CHARS / children.length);
  return (
    <Text variant="title" numberOfLines={1} style={{ fontSize: Math.round(typography.title.fontSize * scale) }}>
      {children}
    </Text>
  );
}
