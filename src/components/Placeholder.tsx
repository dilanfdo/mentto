import { StyleSheet, Text, View } from 'react-native';

import { useColors } from '@/theme/colors';

type Props = {
  title: string;
  description: string;
};

// Temporary body for screens that are not built yet.
export function Placeholder({ title, description }: Props) {
  const colors = useColors();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
      <Text style={[styles.description, { color: colors.textMuted }]}>{description}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
  },
  description: {
    fontSize: 15,
    textAlign: 'center',
  },
});
