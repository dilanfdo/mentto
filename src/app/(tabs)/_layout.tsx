import { Tabs } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, type IconName } from '@/components/ui';
import { fonts, radii, useTheme } from '@/theme';

function TabIcon({ name, focused }: { name: IconName; focused: boolean }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.pill, focused && { backgroundColor: colors.primarySoft }]}>
      <Icon name={name} size={22} color={focused ? 'onPrimarySoft' : 'textSecondary'} />
    </View>
  );
}

const TABS: { name: string; title: string; icon: IconName; iconActive: IconName }[] = [
  { name: 'today', title: 'Today', icon: 'home-variant-outline', iconActive: 'home-variant' },
  { name: 'students', title: 'Students', icon: 'account-group-outline', iconActive: 'account-group' },
  { name: 'schedule', title: 'Schedule', icon: 'calendar-blank-outline', iconActive: 'calendar-blank' },
  { name: 'fees', title: 'Fees', icon: 'wallet-outline', iconActive: 'wallet' },
];

export default function TabsLayout() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        animation: 'fade',
        tabBarActiveTintColor: colors.text,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarLabelStyle: { fontFamily: fonts.semibold, fontSize: 12 },
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          elevation: 0,
          height: 68 + insets.bottom,
          paddingTop: 8,
          paddingBottom: insets.bottom + 8,
        },
        sceneStyle: { backgroundColor: colors.background },
        tabBarAllowFontScaling: false,
      }}
    >
      {TABS.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: tab.title,
            tabBarIcon: ({ focused }) => <TabIcon name={focused ? tab.iconActive : tab.icon} focused={focused} />,
          }}
        />
      ))}
    </Tabs>
  );
}

const styles = StyleSheet.create({
  pill: {
    width: 56,
    height: 30,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
