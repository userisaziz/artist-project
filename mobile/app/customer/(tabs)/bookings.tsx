import { useState } from 'react';
import { FlatList, Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '../../../src/core/components/AppText';
import { Avatar } from '../../../src/core/components/Avatar';
import { Segmented } from '../../../src/core/components/Segmented';
import { StatusPill } from '../../../src/core/components/StatusPill';
import { EmptyView, ErrorView, LoadingView } from '../../../src/core/components/StateViews';
import { useTheme } from '../../../src/core/theme/theme-provider';
import { useCustomerBookings } from '../../../src/bookings/queries';
import { STATUS_PILL } from '../../../src/bookings/status';
import { formatWhen } from '../../../src/core/lib/time';
import type { Booking, CustomerBookingScope } from '../../../src/core/api/types';

const SCOPES: { key: CustomerBookingScope; label: string }[] = [
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'past', label: 'Past' },
];

// Spec §2 Bookings tab: Upcoming / Past, each card with its status pill; reviewable past bookings get "Review".
export default function CustomerBookings() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [scope, setScope] = useState<CustomerBookingScope>('upcoming');
  const list = useCustomerBookings(scope);
  const items = list.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background, paddingTop: insets.top + theme.spacing.md }}>
      <View style={{ paddingHorizontal: theme.spacing.md, gap: 12 }}>
        <AppText variant="display" style={{ fontSize: 30, lineHeight: 34, color: theme.colors.heading }}>Bookings</AppText>
        <Segmented options={SCOPES} value={scope} onChange={setScope} />
      </View>
      <FlatList
        data={items}
        keyExtractor={(b) => b.id}
        contentContainerStyle={{ padding: theme.spacing.md, gap: 12 }}
        renderItem={({ item }) => <BookingCard booking={item} onPress={() => router.push({ pathname: '/customer/booking/[id]', params: { id: item.id } })} />}
        onEndReachedThreshold={0.5}
        onEndReached={() => { if (list.hasNextPage && !list.isFetchingNextPage) void list.fetchNextPage(); }}
        ListEmptyComponent={
          list.isPending ? <LoadingView />
            : list.isError ? <ErrorView error={list.error} onRetry={() => { void list.refetch(); }} />
              : <EmptyView message={scope === 'upcoming' ? 'No upcoming bookings. Find an artist on Explore.' : 'No past bookings yet.'} />
        }
      />
    </View>
  );
}

function BookingCard({ booking, onPress }: { booking: Booking; onPress: () => void }) {
  const theme = useTheme();
  const pill = STATUS_PILL[booking.status];
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={{ borderRadius: 18, borderWidth: 1, borderColor: theme.colors.separator, backgroundColor: theme.colors.surface, padding: 14, gap: 10 }}>
      <StatusPill label={pill.label} tone={pill.tone} />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Avatar uri={booking.artist.photo_url} name={booking.artist.business_name} size={44} />
        <View style={{ flex: 1 }}>
          <AppText variant="subtitle" style={{ fontSize: 14.5, lineHeight: 20, color: theme.colors.textPrimary }}>{booking.service_name}</AppText>
          <AppText variant="caption" style={{ color: theme.colors.textMuted }}>{booking.artist.business_name}</AppText>
        </View>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <AppText variant="label" style={{ color: theme.colors.textSecondary }}>{formatWhen(booking.start_at)}</AppText>
        {booking.can_review ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Review ${booking.service_name}`}
            onPress={onPress}
            hitSlop={8}
            style={{ height: 32, paddingHorizontal: 14, borderRadius: theme.radii.pill, justifyContent: 'center', backgroundColor: theme.colors.brandSoft }}
          >
            <AppText variant="label" style={{ fontSize: 13, color: theme.colors.brand }}>★ Review</AppText>
          </Pressable>
        ) : null}
      </View>
    </Pressable>
  );
}
