import { StyleSheet, View } from 'react-native';

import { fonts, sizes, useTheme } from '@/theme';

import { Text } from './Text';

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const first = parts[0][0] ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return (first + last).toUpperCase();
}

function hash(value: string): number {
  let h = 0;
  for (let i = 0; i < value.length; i += 1) h = (h * 31 + value.charCodeAt(i)) | 0;
  return Math.abs(h);
}

type Props = {
  name: string;
  size?: number;
  dimmed?: boolean;
};

export function Avatar({ name, size = sizes.avatar, dimmed }: Props) {
  const { avatars } = useTheme();
  const tone = avatars[hash(name) % avatars.length];
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no"
      style={[
        styles.base,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: tone.bg, opacity: dimmed ? 0.5 : 1 },
      ]}
    >
      <Text
        allowFontScaling={false}
        style={{ color: tone.fg, fontFamily: fonts.semibold, fontSize: size * 0.38, lineHeight: size * 0.5 }}
      >
        {initials(name)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
