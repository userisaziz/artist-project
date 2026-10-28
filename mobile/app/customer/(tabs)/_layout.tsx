import { Tabs } from 'expo-router/js-tabs';
import { useTheme } from '../../../src/core/theme/theme-provider';
import { TabIcon } from '../../../src/components/common/TabIcon';
import type { TabIconName } from '../../../src/components/common/TabIcon';

const TABS: { name: string; title: string; icon: TabIconName }[] = [
  { name: 'home', title: 'Home', icon: 'home' },
  { name: 'explore', title: 'Explore', icon: 'explore' },
  { name: 'feed', title: 'Feed', icon: 'feed' },
  { name: 'shop', title: 'Shop', icon: 'shop' },
  { name: 'profile', title: 'Profile', icon: 'profile' },
];

// Spec §2: Home, Explore, Bookings, Profile. Feed and Shop come in later increments.
export default function CustomerTabs() {
  const theme = useTheme();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        freezeOnBlur: true, // a tab out of sight stops re-rendering (clock ticks, polls) while another is in use
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
      {/* Bookings live under Profile → My bookings, as in the design; the route stays, off the tab bar. */}
      <Tabs.Screen name="bookings" options={{ href: null }} />
    </Tabs>
  );
}
