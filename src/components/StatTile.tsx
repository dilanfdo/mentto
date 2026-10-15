import { StyleSheet, View } from 'react-native';

import { spacing } from '@/theme';

import { Card, Icon, Text, type IconName } from './ui';

type Props = {
  icon: IconName;
  label: string;
  value: string;
  caption?: string;
  onPress?: () => void;
};

export function StatTile({ icon, label, value, caption, onPress }: Props) {
  return (
    <Card
      onPress={onPress}
      style={styles.tile}
      accessibilityLabel={[label, value, caption].filter(Boolean).join(', ')}
    >
      <View style={styles.labelRow}>
        <Icon name={icon} size={18} color="primary" />
        <Text variant="labelStrong" color="textSecondary" numberOfLines={1}>
          {label}
        </Text>
      </View>
      <Text variant="title" numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      {caption && (
        <Text variant="caption" color="textTertiary" numberOfLines={1}>
          {caption}
        </Text>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  tile: {
    flex: 1,
    gap: spacing.xxs,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxs,
    marginBottom: spacing.xxs,
  },
});
