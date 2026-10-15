import { useColorScheme } from 'react-native';

const light = {
  background: '#F7F7FB',
  surface: '#FFFFFF',
  text: '#16161D',
  textMuted: '#6B6B7B',
  primary: '#4F46E5',
  border: '#E4E4EC',
};

const dark: typeof light = {
  background: '#0E0E14',
  surface: '#1A1A23',
  text: '#F2F2F7',
  textMuted: '#9A9AAB',
  primary: '#818CF8',
  border: '#2A2A36',
};

export type Colors = typeof light;

export function useColors(): Colors {
  return useColorScheme() === 'dark' ? dark : light;
}
