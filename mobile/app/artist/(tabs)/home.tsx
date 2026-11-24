import { RefreshControl, ScrollView, View } from 'react-native';
import { PressableFeedback } from '../../../src/components/common/PressableFeedback';
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
import { usePullToRefresh } from '../../../src/hooks/common/use-pull-to-refresh';
import { NotificationBell } from '../../../src/components/notifications/NotificationBell';
import { useArtistBookingActions } from '../../../src/hooks/bookings/artist-booking-actions';
import { RequestCard } from '../../../src/components/bookings/RequestCard';
import { useChatOpener } from '../../../src/hooks/chat/chat';
import { AgendaRow } from '../../../src/components/bookings/AgendaRow';
import { EarningsHero } from '../../../src/components/bookings/EarningsHero';
import { DashboardStats, type StatKey } from '../../../src/components/bookings/DashboardStats';
import { AttentionList } from '../../../src/components/bookings/AttentionList';
import { QuickActions, type QuickActionKey } from '../../../src/components/bookings/QuickActions';
import { attentionItems, type AttentionKey } from '../../../src/utils/bookings/dashboard';

const HOME_REQUESTS = 2;

const STAT_ROUTES: Record<StatKey, Href> = {
  requests: '/artist/bookings',
  week: '/artist/calendar',
  rating: '/artist/reviews',
  enquiries: '/artist/enquiries',
};
const ATTENTION_ROUTES: Record<AttentionKey, Href> = {
  expiring: '/artist/bookings',
  reschedules: { pathname: '/artist/bookings', params: { scope: 'upcoming' } },
  enquiries: '/artist/enquiries',
};
const ACTION_ROUTES: Record<QuickActionKey, Href> = {
  'block-time': '/artist/calendar',
  'new-post': '/artist/posts/new',
  services: '/artist/services',
  profile: '/artist/public-profile',
};

function SectionTitle({ title, onSeeAll }: { title: string; onSeeAll?: () => void }) {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginTop: theme.spacing[3] }}>
      <AppText variant="sectionTitle" style={{ color: theme.colors.heading }}>{title}</AppText>
      {onSeeAll ? (
        <PressableFeedback accessibilityRole="button" accessibilityLabel={`See all ${title.toLowerCase()}`} onPress={onSeeAll} hitSlop={8}>
          <AppText variant="labelLg" style={{ color: theme.colors.brand }}>See all</AppText>
        </PressableFeedback>
      ) : null}
    </View>
  );
}

// Artist home: what needs action now, how the month is going, the first two requests, today's schedule and shortcuts.
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
  const pull = usePullToRefresh(() => Promise.all([dashboard.refetch(), requests.refetch()]));
  const firstRequests = (requests.data?.pages[0]?.items ?? []).slice(0, HOME_REQUESTS);
  const d = dashboard.data;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      contentContainerStyle={{ paddingTop: insets.top + theme.spacing.md, paddingHorizontal: theme.spacing.md, paddingBottom: theme.spacing.xl, gap: theme.spacing[3] }}
      refreshControl={<RefreshControl refreshing={pull.refreshing} onRefresh={pull.onRefresh} tintColor={theme.colors.brand} colors={[theme.colors.brand]} />}
    >
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: theme.spacing[3] }}>
        <View style={{ flex: 1 }}>
          <AppText variant="caption" style={{ color: theme.colors.textMuted }}>{formatLongDay(istDateKey(now))}</AppText>
          <AppText variant="display" style={{ color: theme.colors.heading }}>
            {`${greeting(now)}, `}<Accent>{user?.first_name || 'there'}</Accent>
          </AppText>
        </View>
        <NotificationBell onPress={() => router.push('/artist/notifications')} />
      </View>
      <RequirementsBanner onOpen={(action) => router.push(action as Href)} />

      {dashboard.isPending ? <LoadingView label="Loading your dashboard" shape="tiles" /> : null}
      {dashboard.isError && !d ? <ErrorView error={dashboard.error} onRetry={() => { void dashboard.refetch(); }} /> : null}
      {d ? (
        <>
          <EarningsHero dashboard={d} onPress={() => router.push('/artist/earnings')} />
          <DashboardStats dashboard={d} onOpen={(key) => router.navigate(STAT_ROUTES[key])} />
          <SectionTitle title="Needs your attention" />
          <AttentionList items={attentionItems(d)} onOpen={(key) => router.navigate(ATTENTION_ROUTES[key])} />
        </>
      ) : null}

      <SectionTitle title="New requests" onSeeAll={() => router.navigate('/artist/bookings')} />
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

      <SectionTitle title="Today" onSeeAll={() => router.navigate('/artist/calendar')} />
      {d && !d.today.length ? <EmptyView message="Nothing booked today." /> : null}
      {d?.today.map((b) => <AgendaRow key={b.id} booking={b} onPress={() => router.push({ pathname: '/artist/booking/[id]', params: { id: b.id } })} />)}

      <SectionTitle title="Quick actions" />
      <QuickActions onAction={(key) => router.push(ACTION_ROUTES[key])} />
    </ScrollView>
  );
}
