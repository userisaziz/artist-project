import { View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { PressableFeedback } from '../common/PressableFeedback';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '../common/AppText';
import { BackHeader } from '../common/BackHeader';
import { EmptyView, ErrorView, LoadingView } from '../common/StateViews';
import { NotificationRow } from './NotificationRow';
import { useTheme } from '../../core/theme/theme-provider';
import { useNow } from '../../hooks/common/use-now';
import { useMarkRead, useNotifications } from '../../hooks/notifications/notifications';
import type { AppNotification } from '../../types/notifications/notifications';
import { usePullToRefresh } from '../../hooks/common/use-pull-to-refresh';

/** Bookings, orders, messages and support replies that need the person's attention, newest first.
 *  Opening one marks it read and goes where it points. */
export function NotificationInbox({ onNavigate }: { onNavigate: (link: string) => void }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const now = useNow();
  const inbox = useNotifications();
  const pull = usePullToRefresh(inbox.refetch);
  const markRead = useMarkRead();
  const items = inbox.data?.pages.flatMap((p) => p.items) ?? [];
  const anyUnread = items.some((n) => !n.read_at);

  const open = (n: AppNotification) => {
    if (!n.read_at) markRead.mutate([n.id]);
    if (n.link) onNavigate(n.link);
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background, paddingTop: insets.top + theme.spacing.sm, paddingHorizontal: theme.spacing.md }}>
      <BackHeader title="Notifications" />
      {anyUnread ? (
        <PressableFeedback accessibilityRole="button" onPress={() => markRead.mutate(null)} style={{ alignSelf: 'flex-end', paddingVertical: 8 }}>
          <AppText variant="label" style={{ color: theme.colors.brand }}>Mark all read</AppText>
        </PressableFeedback>
      ) : null}
      {inbox.isPending ? <LoadingView label="Loading notifications" /> : null}
      {inbox.isError && !inbox.data ? <ErrorView error={inbox.error} onRetry={() => { void inbox.refetch(); }} /> : null}
      {inbox.isSuccess && !items.length ? <EmptyView message="Nothing yet. Booking updates, orders and messages show up here." /> : null}
      <FlashList
        refreshing={pull.refreshing}
        onRefresh={pull.onRefresh}
        data={items}
        keyExtractor={(n) => n.id}
        renderItem={({ item }) => <NotificationRow item={item} now={now} onOpen={open} />}
        onEndReached={() => { if (inbox.hasNextPage && !inbox.isFetchingNextPage) void inbox.fetchNextPage(); }}
        contentContainerStyle={{ paddingBottom: insets.bottom + theme.spacing.xl }}
      />
    </View>
  );
}
