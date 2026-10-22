import { Pressable, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import type { Href } from 'expo-router';
import { RequirementsBanner } from '../../../src/components/artist-onboarding/RequirementsBanner';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText, Accent } from '../../../src/components/common/AppText';
import { EmptyView, ErrorView, LoadingView } from '../../../src/components/common/StateViews';
import { useTheme } from '../../../src/core/theme/theme-provider';
import { useAuth } from '../../../src/context/auth/auth-provider';
import { useArtistBookings, useArtistDashboard } from '../../../src/hooks/bookings/bookings';
import { formatLongDay, greeting, istDateKey } from '../../../src/utils/common/time';
import { useNow } from '../../../src/hooks/common/use-now';
import { NotificationBell } from '../../../src/components/notifications/NotificationBell';
import { formatPrice } from '../../../src/utils/common/format';
import { useArtistBookingActions } from '../../../src/hooks/bookings/artist-booking-actions';
import { RequestCard } from '../../../src/components/bookings/RequestCard';
import { useChatOpener } from '../../../src/hooks/chat/chat';
import { AgendaRow } from '../../../src/components/bookings/AgendaRow';

const HOME_REQUESTS = 2;

// Spec §3 Home: the date and greeting, this month's earnings, the first two requests, and today's schedule.
export default function ArtistHome() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const now = useNow();
  const dashboard = useArtistDashboard();
  const requests = useArtistBookings('requests');
  const { run, busyId, errors } = useArtistBookingActions();
  const chat = useChatOpener('artist');
  const firstRequests = (requests.data?.pages[0]?.items ?? []).slice(0, HOME_REQUESTS);
  const heading = { fontSize: 22, lineHeight: 28, color: theme.colors.heading } as const;
  const d = dashboard.data;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.colors.background }} contentContainerStyle={{ paddingTop: insets.top + theme.spacing.md, paddingHorizontal: theme.spacing.md, paddingBottom: theme.spacing.xl, gap: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
        <View style={{ flex: 1 }}>
          <AppText variant="caption" style={{ color: theme.colors.textMuted }}>{formatLongDay(istDateKey(now))}</AppText>
          <AppText variant="display" style={{ fontSize: 28, lineHeight: 32, color: theme.colors.heading }}>
            {`${greeting(now)}, `}<Accent>{user?.first_name || 'there'}</Accent>
          </AppText>
        </View>
        <NotificationBell onPress={() => router.push('/artist/notifications')} />
      </View>
      <RequirementsBanner onOpen={(action) => router.push(action as Href)} />

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Earnings this month, see every month"
        onPress={() => router.push('/artist/earnings')}
        style={{ borderRadius: theme.radii.card, backgroundColor: theme.colors.brand, padding: 18, ...theme.shadows.md }}
      >
        <AppText variant="caption" style={{ color: theme.colors.textOnBrand, opacity: 0.8 }}>Earnings this month</AppText>
        <AppText variant="display" style={{ fontSize: 32, lineHeight: 38, color: theme.colors.textOnBrand }}>{d ? formatPrice(d.earnings_this_month_paise) : '—'}</AppText>
        <AppText variant="caption" style={{ color: theme.colors.textOnBrand, opacity: 0.85 }}>
          {d ? `${d.completed_this_month} completed · ${d.upcoming} upcoming` : ' '}
        </AppText>
      </Pressable>
      {dashboard.isError ? <ErrorView error={dashboard.error} onRetry={() => { void dashboard.refetch(); }} /> : null}

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 12 }}>
        <AppText variant="title" style={heading}>New requests</AppText>
        <Pressable accessibilityRole="button" onPress={() => router.navigate('/artist/bookings')} hitSlop={8}>
          <AppText variant="label" style={{ fontSize: 13, color: theme.colors.brand }}>See all</AppText>
        </Pressable>
      </View>
      {requests.isPending ? <LoadingView /> : null}
      {requests.isError ? <ErrorView error={requests.error} onRetry={() => { void requests.refetch(); }} /> : null}
      {requests.isSuccess && !firstRequests.length ? <EmptyView message="No new requests. They’ll show up here." /> : null}
      {firstRequests.map((b) => (
        <RequestCard
          key={b.id}
          booking={b}
          now={now}
          busy={busyId === b.id}
          error={errors[b.id]}
          onAccept={() => { void run(b.id, { kind: 'accept' }); }}
          onDecline={(reason) => { void run(b.id, { kind: 'decline', reason }); }}
          onMessage={() => { void chat.open(b.id); }}
          onOpen={() => router.push({ pathname: '/artist/booking/[id]', params: { id: b.id } })}
        />
      ))}

      <AppText variant="title" style={[heading, { marginTop: 12 }]}>Today</AppText>
      {dashboard.isPending ? <LoadingView /> : null}
      {d && !d.today.length ? <EmptyView message="Nothing booked today." /> : null}
      {d?.today.map((b) => <AgendaRow key={b.id} booking={b} onPress={() => router.push({ pathname: '/artist/booking/[id]', params: { id: b.id } })} />)}
    </ScrollView>
  );
}
