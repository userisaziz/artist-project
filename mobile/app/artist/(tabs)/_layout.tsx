import { Pressable } from 'react-native';
import { Tabs } from 'expo-router/js-tabs';
import { useTheme } from '../../../src/core/theme/theme-provider';
import { TabIcon } from '../../../src/components/common/TabIcon';
import type { TabIconName } from '../../../src/components/common/TabIcon';
import { useArtistDashboard } from '../../../src/hooks/bookings/bookings';
import { useConversations } from '../../../src/hooks/chat/chat';
import { tabBadge } from '../../../src/utils/common/badge';

const TABS: { name: string; title: string; icon: TabIconName }[] = [
  { name: 'home', title: 'Home', icon: 'home' },
  { name: 'bookings', title: 'Bookings', icon: 'bookings' },
  { name: 'calendar', title: 'Calendar', icon: 'calendar' },
  { name: 'messages', title: 'Messages', icon: 'messages' },
  { name: 'me', title: 'Me', icon: 'profile' },
];

// Spec §3: the approved artist's tabs, in the prototype's order.
export default function ArtistTabs() {
  const theme = useTheme();
  // Badges: requests waiting for an answer, and unread messages. Both queries poll, and a push refreshes them.
  const requests = useArtistDashboard().data?.requests ?? 0;
  const unread = (useConversations('artist').data?.pages[0]?.items ?? []).reduce((sum, c) => sum + c.unread_count, 0);
  const badges: Record<string, number> = { bookings: requests, messages: unread };
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        freezeOnBlur: true, // a tab out of sight stops re-rendering (clock ticks, polls) while another is in use
        tabBarActiveTintColor: theme.colors.brand,
        tabBarInactiveTintColor: theme.colors.textMuted,
        tabBarStyle: { backgroundColor: theme.colors.surface, borderTopColor: theme.colors.separator },
        tabBarLabelStyle: { fontFamily: theme.typography.label.fontFamily, fontSize: theme.typography.labelSm.fontSize },
        tabBarBadgeStyle: { backgroundColor: theme.colors.brand, color: theme.colors.textOnBrand, fontFamily: theme.typography.label.fontFamily },
        tabBarButton: ({ href, ...props }) => <Pressable {...props} accessibilityRole="button" />,
        sceneStyle: { backgroundColor: theme.colors.background },
      }}
    >
      {TABS.map((t) => (
        <Tabs.Screen
          key={t.name}
          name={t.name}
          options={{
            title: t.title,
            tabBarBadge: tabBadge(badges[t.name] ?? 0),
            tabBarAccessibilityLabel: badges[t.name] ? `${t.title} tab, ${badges[t.name]} new` : `${t.title} tab`,
            tabBarIcon: ({ color }) => <TabIcon name={t.icon} color={color} />,
          }}
        />
      ))}
    </Tabs>
  );
}
