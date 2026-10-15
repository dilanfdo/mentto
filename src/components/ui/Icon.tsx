import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { ComponentProps } from 'react';

import { sizes, useTheme, type ColorTokens } from '@/theme';

export type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

type Props = {
  name: IconName;
  size?: number;
  color?: keyof ColorTokens;
  /** Overrides `color` with a raw value, for avatar and badge tints. */
  tint?: string;
};

export function Icon({ name, size = sizes.icon, color = 'textSecondary', tint }: Props) {
  const { colors } = useTheme();
  return (
    <MaterialCommunityIcons
      name={name}
      size={size}
      color={tint ?? colors[color]}
      accessibilityElementsHidden
      importantForAccessibility="no"
    />
  );
}
