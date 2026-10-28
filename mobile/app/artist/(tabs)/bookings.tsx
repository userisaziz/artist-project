import { useState } from 'react';
import { FlatList, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '../../../src/components/common/AppText';
import { Segmented } from '../../../src/components/common/Segmented';
import { EmptyView, ErrorView, LoadingView } from '../../../src/components/common/StateViews';
import { useTheme } from '../../../src/core/theme/theme-provider';
import { useArtistBookings } from '../../../src/hooks/bookings/bookings';
import { useNow } from '../../../src/hooks/common/use-now';
import { useArtistBookingActions } from '../../../src/hooks/bookings/artist-booking-actions';
import { RequestCard } from '../../../src/components/bookings/RequestCard';
import { useChatOpener } from '../../../src/hooks/chat/chat';
import { AgendaRow } from '../../../src/components/bookings/AgendaRow';
import type { ArtistBookingScope, Booking } from '../../../src/types/bookings/bookings';
import { usePullToRefresh } from '../../../src/hooks/common/use-pull-to-refresh';

const EMPTY: Record<ArtistBookingScope, string> = {
  requests: 'No requests waiting for you.',
  upcoming: 'No confirmed bookings coming up.',
  past: 'Nothing here yet.',
};

// Spec §3 Bookings: Requests · n / Upcoming / Past.
export default function ArtistBookings() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const openBooking = (id: string) => router.push({ pathname: '/artist/booking/[id]', params: { id } });
  const now = useNow();
  const [scope, setScope] = useState<ArtistBookingScope>('requests');
  const requests = useArtistBookings('requests'); // always loaded: it feeds the "Requests · n" count
  const other = useArtistBookings(scope === 'past' ? 'past' : 'upcoming');
  const pull = usePullToRefresh(() => Promise.all([requests.refetch(), other.refetch()]));
  const list = scope === 'requests' ? requests : other;
  const items = list.data?.pages.flatMap((p) => p.items) ?? [];
  const requestCount = requests.data ? `${requests.data.pages.reduce((n, p) => n + p.items.length, 0)}${requests.hasNextPage ? '+' : ''}` : '…';
  const { run, busyId, errors } = useArtistBookingActions();
  const chat = useChatOpener('artist');

  const renderItem = ({ item }: { item: Booking }) => {
    if (scope === 'requests') {
      return (
        <RequestCard
          booking={item}
          now={now}
          busy={busyId === item.id}
          error={errors[item.id]}
          onAccept={() => { void run(item.id, { kind: 'accept' }); }}
          onDecline={(reason) => { void run(item.id, { kind: 'decline', reason }); }}
          onMessage={() => { void chat.open(item.id); }}
          onOpen={() => openBooking(item.id)}
        />
      );
    }
    const complete = scope === 'upcoming'
      ? { enabled: now >= Date.parse(item.start_at), busy: busyId === item.id, error: errors[item.id], onPress: () => { void run(item.id, { kind: 'complete' }); } }
      : undefined;
    return <AgendaRow booking={item} showDate complete={complete} onPress={() => openBooking(item.id)} />;
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background, paddingTop: insets.top + theme.spacing.md }}>
      <View style={{ paddingHorizontal: theme.spacing.md, gap: 12 }}>
        <AppText variant="display" style={{ fontSize: 30, lineHeight: 34, color: theme.colors.heading }}>Bookings</AppText>
        <Segmented
          options={[{ key: 'requests', label: `Requests · ${requestCount}` }, { key: 'upcoming', label: 'Upcoming' }, { key: 'past', label: 'Past' }]}
          value={scope}
          onChange={setScope}
        />
      </View>
      <FlatList
        refreshing={pull.refreshing}
        onRefresh={pull.onRefresh}
        data={items}
        keyExtractor={(b) => b.id}
        contentContainerStyle={{ padding: theme.spacing.md, gap: 12 }}
        renderItem={renderItem}
        extraData={[busyId, errors, now]}
        onEndReachedThreshold={0.5}
        onEndReached={() => { if (list.hasNextPage && !list.isFetchingNextPage) void list.fetchNextPage(); }}
        ListEmptyComponent={
          list.isPending ? <LoadingView />
            : list.isError ? <ErrorView error={list.error} onRetry={() => { void list.refetch(); }} />
              : <EmptyView message={EMPTY[scope]} />
        }
      />
    </View>
  );
}
