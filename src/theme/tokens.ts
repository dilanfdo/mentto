import type { TextStyle } from 'react-native';

// Mentto's design tokens. Screens and components read these through useTheme(); nothing else
// should hard-code a color, font, spacing value or duration.

const lightColors = {
  background: '#F6F6FA',
  surface: '#FFFFFF',
  surfaceMuted: '#EEEEF4',
  surfacePressed: '#E6E6EF',
  text: '#15151F',
  textSecondary: '#5B5B70',
  textTertiary: '#86869B',
  border: '#E2E2EB',
  borderStrong: '#C9C9D6',

  primary: '#4F46E5',
  primaryPressed: '#4338CA',
  onPrimary: '#FFFFFF',
  primarySoft: '#ECEDFF',
  onPrimarySoft: '#3730A3',

  success: '#15803D',
  successSoft: '#DDF6E5',
  onSuccessSoft: '#14532D',
  warning: '#B45309',
  warningSoft: '#FDF0D5',
  onWarningSoft: '#7C2D12',
  danger: '#DC2626',
  dangerSoft: '#FDE4E4',
  onDangerSoft: '#7F1D1D',

  scrim: 'rgba(15, 15, 25, 0.45)',
  ripple: 'rgba(79, 70, 229, 0.10)',
};

export type ColorTokens = typeof lightColors;

const darkColors: ColorTokens = {
  background: '#0E0E15',
  surface: '#171721',
  surfaceMuted: '#20202C',
  surfacePressed: '#2A2A38',
  text: '#F2F2F8',
  textSecondary: '#A9A9BD',
  textTertiary: '#77778C',
  border: '#272735',
  borderStrong: '#3A3A4C',

  primary: '#8B8FFA',
  primaryPressed: '#A5A8FB',
  onPrimary: '#10102A',
  primarySoft: '#23234A',
  onPrimarySoft: '#CDD1FF',

  success: '#4ADE80',
  successSoft: '#132C1D',
  onSuccessSoft: '#A7F3C0',
  warning: '#FBBF24',
  warningSoft: '#33260B',
  onWarningSoft: '#FDE68A',
  danger: '#F87171',
  dangerSoft: '#3A1618',
  onDangerSoft: '#FECACA',

  scrim: 'rgba(0, 0, 0, 0.6)',
  ripple: 'rgba(139, 143, 250, 0.16)',
};

/** Soft background/foreground pairs for student avatars, picked by a hash of the name. */
const lightAvatars = [
  { bg: '#E7E8FF', fg: '#3730A3' },
  { bg: '#DDF3EC', fg: '#065F46' },
  { bg: '#FDEBD8', fg: '#9A3412' },
  { bg: '#F6E3F3', fg: '#86198F' },
  { bg: '#E0EEFB', fg: '#1E40AF' },
  { bg: '#F3EED9', fg: '#713F12' },
];

const darkAvatars: typeof lightAvatars = [
  { bg: '#272A5A', fg: '#C7CBFF' },
  { bg: '#163A30', fg: '#A7F3D0' },
  { bg: '#3D2614', fg: '#FED7AA' },
  { bg: '#3A1F3A', fg: '#F5D0FE' },
  { bg: '#1A2D47', fg: '#BFDBFE' },
  { bg: '#363016', fg: '#FDE68A' },
];

export const fonts = {
  regular: 'PlusJakartaSans_400Regular',
  medium: 'PlusJakartaSans_500Medium',
  semibold: 'PlusJakartaSans_600SemiBold',
  bold: 'PlusJakartaSans_700Bold',
};

export const typography = {
  display: { fontFamily: fonts.bold, fontSize: 28, lineHeight: 34, letterSpacing: -0.4 },
  title: { fontFamily: fonts.bold, fontSize: 21, lineHeight: 28, letterSpacing: -0.2 },
  headline: { fontFamily: fonts.semibold, fontSize: 17, lineHeight: 24 },
  body: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 22 },
  bodyStrong: { fontFamily: fonts.semibold, fontSize: 15, lineHeight: 22 },
  label: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 18 },
  labelStrong: { fontFamily: fonts.semibold, fontSize: 13, lineHeight: 18 },
  caption: { fontFamily: fonts.medium, fontSize: 12, lineHeight: 16 },
  amount: { fontFamily: fonts.bold, fontSize: 30, lineHeight: 36, letterSpacing: -0.6 },
} satisfies Record<string, TextStyle>;

export type TypographyVariant = keyof typeof typography;

/** 8-point scale, with 4 and 12 for tight spots. */
export const spacing = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const radii = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  pill: 999,
};

export const sizes = {
  touch: 48,
  button: 52,
  buttonSmall: 40,
  input: 52,
  icon: 22,
  avatar: 44,
};

export const motion = {
  fast: 140,
  base: 220,
  slow: 320,
};

export type Theme = {
  dark: boolean;
  colors: ColorTokens;
  avatars: typeof lightAvatars;
};

export const lightTheme: Theme = { dark: false, colors: lightColors, avatars: lightAvatars };
export const darkTheme: Theme = { dark: true, colors: darkColors, avatars: darkAvatars };
