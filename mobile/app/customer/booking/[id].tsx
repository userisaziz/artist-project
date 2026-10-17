import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '../../../src/components/AppText';
import { AppButton } from '../../../src/components/AppButton';
import { Avatar } from '../../../src/components/Avatar';
import { BackHeader } from '../../../src/components/BackHeader';
import { Card } from '../../../src/components/Card';
import { InfoRow } from '../../../src/components/InfoRow';
import { StatusPill } from '../../../src/components/StatusPill';
import { ErrorView, LoadingView } from '../../../src/components/StateViews';
import { useTheme } from '../../../src/theme/theme-provider';
import { useBooking, useBookingWrite } from '../../../src/bookings/queries';
import { Breakdown } from '../../../src/bookings/Breakdown';
import { STATUS_PILL } from '../../../src/bookings/status';
import { refundDueOnCustomerCancel } from '../../../src/bookings/pricing';
import { formatWhen } from '../../../src/bookings/time';
import { useNow } from '../../../src/bookings/use-now';
import { formatPrice } from '../../../src/artist/format';
import { cancelBooking } from '../../../src/api/endpoints/bookings';
import { errorMessage } from '../../../src/api/error-message';
import { RateBookingCard } from '../../../src/reviews/RateBookingCard';
import type { Booking } from '../../../src/api/types';

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
  const now = useNow();
  const [confirming, setConfirming] = useState(false);
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
  const refundNote = refundDueOnCustomerCancel(start, now)
    ? `Your ${deposit} deposit will be refunded.`
    : `It’s less than 72 hours to the start, so the ${deposit} deposit won’t be refunded.`;
  const reason = b.decline_reason ?? b.cancel_reason;
  const ended = refundLine(b);

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
        <Breakdown money={b} paid />
      </Card>
      {reason ? <AppText variant="body" style={{ color: theme.colors.textSecondary }}>{`Reason: ${reason}`}</AppText> : null}
      {ended ? <AppText variant="caption" style={{ color: theme.colors.textMuted }}>{ended}</AppText> : null}
      {b.status === 'requested' ? (
        <AppText variant="caption" style={{ color: theme.colors.pendingInk }}>The artist has 3 hours to confirm. If they don’t, the deposit is refunded.</AppText>
      ) : null}

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
