import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '../../../src/components/common/AppText';
import { AppButton } from '../../../src/components/common/AppButton';
import { Avatar } from '../../../src/components/common/Avatar';
import { BackHeader } from '../../../src/components/common/BackHeader';
import { Card } from '../../../src/components/common/Card';
import { InfoRow } from '../../../src/components/common/InfoRow';
import { StatusPill } from '../../../src/components/common/StatusPill';
import { ErrorView, LoadingView } from '../../../src/components/common/StateViews';
import { useTheme } from '../../../src/core/theme/theme-provider';
import { useBooking, useBookingWrite } from '../../../src/hooks/bookings/bookings';
import { Breakdown } from '../../../src/components/bookings/Breakdown';
import { AddonLines } from '../../../src/components/bookings/AddonLines';
import { STATUS_PILL } from '../../../src/utils/bookings/status';
import { refundDueOnCustomerCancel } from '../../../src/utils/bookings/pricing';
import { formatWhen } from '../../../src/utils/common/time';
import { useNow } from '../../../src/hooks/common/use-now';
import { formatPrice } from '../../../src/utils/common/format';
import { cancelBooking, withdrawReschedule } from '../../../src/api/bookings/bookings';
import { errorMessage } from '../../../src/core/api/error-message';
import { RateBookingCard } from '../../../src/components/reviews/RateBookingCard';
import { useChatOpener } from '../../../src/hooks/chat/chat';
import type { Booking } from '../../../src/types/bookings/bookings';

/** What happened to the deposit once a booking has ended without the service. */
function refundLine(b: Booking): string | null {
  if (b.refund_due === null) return null;
  const deposit = formatPrice(b.deposit_paise);
  return b.refund_due ? `Your ${deposit} deposit is being refunded.` : `The ${deposit} deposit isn’t refunded (cancelled within 72 hours of the start).`;
}

// Spec §2 booking/[id]: details, "Rate your experience" (Increment 6), the breakdown, and "Cancel booking" with a confirm step that states the refund.
export default function BookingDetail() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { id = '' } = useLocalSearchParams<{ id: string }>();
  const booking = useBooking(id);
  const write = useBookingWrite();
  const chat = useChatOpener('customer');
  const now = useNow();
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!booking.data) {
    return (
      <View style={{ flex: 1, paddingTop: insets.top + theme.spacing.sm, paddingHorizontal: theme.spacing.md, backgroundColor: theme.colors.background }}>
        <BackHeader title="Booking" />
        {booking.isError ? <ErrorView error={booking.error} onRetry={() => { void booking.refetch(); }} /> : <LoadingView />}
      </View>
    );
  }
  const b = booking.data;
  const pill = STATUS_PILL[b.status];
  const start = Date.parse(b.start_at);
  const cancellable = (b.status === 'requested' || b.status === 'confirmed') && now < start;
  const deposit = formatPrice(b.deposit_paise);
  const refundNote = !b.deposit_paise
    ? 'The artist will be told you cancelled.'
    : refundDueOnCustomerCancel(start, now)
      ? `Your ${deposit} deposit will be refunded.`
      : `It’s less than 72 hours to the start, so the ${deposit} deposit won’t be refunded.`;
  const reason = b.decline_reason ?? b.cancel_reason;
  const movable = b.status === 'confirmed' && now < start && !b.reschedule && !!b.service_id;
  const ended = refundLine(b);

  const withdraw = async () => {
    setWithdrawing(true);
    setError(null);
    try {
      await write(() => withdrawReschedule(b.id));
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setWithdrawing(false);
    }
  };

  const cancel = async () => {
    setCancelling(true);
    setError(null);
    try {
      await write(() => cancelBooking(b.id));
      setConfirming(false);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setCancelling(false);
    }
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.colors.background }} contentContainerStyle={{ paddingTop: insets.top + theme.spacing.sm, paddingHorizontal: theme.spacing.md, paddingBottom: insets.bottom + theme.spacing.xl, gap: 16 }}>
      <BackHeader title={`Booking ${b.code}`} />
      <StatusPill label={pill.label} tone={pill.tone} />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Avatar uri={b.artist.photo_url} name={b.artist.business_name} size={52} />
        <View style={{ flex: 1 }}>
          <AppText variant="subtitle" style={{ color: theme.colors.textPrimary }}>{b.artist.business_name}</AppText>
          <AppText variant="caption" style={{ color: theme.colors.textMuted }}>{b.artist.city}</AppText>
        </View>
      </View>
      <Card>
        <InfoRow label="Service" value={b.service_name} />
        <InfoRow label="When" value={formatWhen(b.start_at)} />
        <InfoRow label="Where" value={b.address} />
      </Card>
      {b.note ? (
        <View style={{ borderRadius: theme.radii.md, backgroundColor: theme.colors.washTop, padding: 12 }}>
          <AppText variant="caption" style={{ color: theme.colors.textMuted }}>Your note</AppText>
          <AppText variant="body" style={{ color: theme.colors.textSecondary }}>{b.note}</AppText>
        </View>
      ) : null}
      <RateBookingCard booking={b} />
      <Card>
        <AddonLines lines={b.addons} />
        <Breakdown money={b} paid />
      </Card>
      {reason ? <AppText variant="body" style={{ color: theme.colors.textSecondary }}>{`Reason: ${reason}`}</AppText> : null}
      {ended ? <AppText variant="caption" style={{ color: theme.colors.textMuted }}>{ended}</AppText> : null}
      {b.status === 'requested' ? (
        <View style={{ borderRadius: theme.radii.md, backgroundColor: theme.colors.pendingSoft, padding: 12 }}>
          <AppText variant="caption" style={{ color: theme.colors.pendingInk }}>{b.deposit_paise ? 'The artist has 3 hours to confirm. If they don’t, the deposit is refunded.' : 'The artist has 3 hours to confirm. If they don’t, the request expires.'}</AppText>
        </View>
      ) : null}

      {b.reschedule ? (
        <Card style={{ gap: 8 }}>
          <AppText variant="subtitle" style={{ color: theme.colors.textPrimary }}>{`You asked to move it to ${formatWhen(b.reschedule.start_at)}`}</AppText>
          <AppText variant="caption" style={{ color: theme.colors.pendingInk }}>{`Waiting for ${b.artist.business_name}. It stays at ${formatWhen(b.start_at)} until they accept.`}</AppText>
          <AppButton label="Withdraw request" variant="ghost" loading={withdrawing} onPress={() => { void withdraw(); }} />
        </Card>
      ) : null}
      {!b.reschedule && b.reschedule_declined_reason ? (
        <AppText variant="caption" style={{ color: theme.colors.textMuted }}>{`The artist couldn’t move it: ${b.reschedule_declined_reason}`}</AppText>
      ) : null}
      <AppButton label="Message artist" variant="secondary" loading={chat.openingId === b.artist.id} onPress={() => { void chat.open(b.artist.id); }} />
      {movable && !confirming ? <AppButton label="Change time" variant="secondary" onPress={() => router.push({ pathname: '/customer/reschedule/[id]', params: { id: b.id } })} /> : null}
      {cancellable && !confirming ? <AppButton label="Cancel booking" variant="secondary" onPress={() => setConfirming(true)} /> : null}
      {cancellable && confirming ? (
        <Card style={{ gap: 12 }}>
          <AppText variant="subtitle" style={{ color: theme.colors.textPrimary }}>Cancel this booking?</AppText>
          <AppText variant="body" style={{ color: theme.colors.textSecondary }}>{refundNote}</AppText>
          <AppButton label="Yes, cancel" loading={cancelling} onPress={() => { void cancel(); }} />
          <AppButton label="Keep booking" variant="ghost" disabled={cancelling} onPress={() => setConfirming(false)} />
        </Card>
      ) : null}
      {error ? <AppText variant="caption" style={{ color: theme.colors.error }}>{error}</AppText> : null}
    </ScrollView>
  );
}
