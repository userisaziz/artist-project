import { Tabs } from 'expo-router/js-tabs';
import { useTheme } from '../../../src/core/theme/theme-provider';
import { TabIcon } from '../../../src/core/components/TabIcon';
import type { TabIconName } from '../../../src/core/components/TabIcon';

const TABS: { name: string; title: string; icon: TabIconName }[] = [
  { name: 'home', title: 'Home', icon: 'home' },
  { name: 'bookings', title: 'Bookings', icon: 'bookings' },
  { name: 'calendar', title: 'Calendar', icon: 'calendar' },
  { name: 'me', title: 'Me', icon: 'profile' },
];

// Spec §3: the approved artist's tabs. Messages comes with chat.
export default function ArtistTabs() {
  const theme = useTheme();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.brand,
        tabBarInactiveTintColor: theme.colors.textMuted,
        tabBarStyle: { backgroundColor: theme.colors.surface, borderTopColor: theme.colors.separator },
        tabBarLabelStyle: { fontFamily: theme.typography.label.fontFamily, fontSize: 10.5 },
        sceneStyle: { backgroundColor: theme.colors.background },
      }}
    >
      {TABS.map((t) => (
        <Tabs.Screen
          key={t.name}
          name={t.name}
          options={{ title: t.title, tabBarAccessibilityLabel: `${t.title} tab`, tabBarIcon: ({ color }) => <TabIcon name={t.icon} color={color} /> }}
        />
      ))}
    </Tabs>
  );
}
