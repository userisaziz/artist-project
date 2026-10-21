import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppButton } from '../common/AppButton';
import { AppText } from '../common/AppText';
import { Avatar } from '../common/Avatar';
import { BackHeader } from '../common/BackHeader';
import { Card } from '../common/Card';
import { InfoRow } from '../common/InfoRow';
import { StatusPill } from '../common/StatusPill';
import { ErrorView, LoadingView } from '../common/StateViews';
import { RequestCard } from './RequestCard';
import { useTheme } from '../../core/theme/theme-provider';
import { useArtistBooking } from '../../hooks/bookings/bookings';
import { useArtistBookingActions } from '../../hooks/bookings/artist-booking-actions';
import { useNow } from '../../hooks/common/use-now';
import { STATUS_PILL, customerName } from '../../utils/bookings/status';
import { formatWhen } from '../../utils/common/time';
import { formatMaybePrice } from '../../utils/common/format';

interface ArtistBookingDetailProps {
  bookingId: string;
  /** Opens the chat with this booking's customer. */
  onMessage: () => void;
  isOpeningChat: boolean;
}

/** One booking for the artist: a request keeps its Accept / Decline card; later states show the details,
 *  Message and, once the start time has passed, Mark completed. */
export function ArtistBookingDetail({ bookingId, onMessage, isOpeningChat }: ArtistBookingDetailProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const now = useNow();
  const booking = useArtistBooking(bookingId);
  const { run, busyId, errors } = useArtistBookingActions();
  const frame = { paddingTop: insets.top + theme.spacing.sm, paddingHorizontal: theme.spacing.md, backgroundColor: theme.colors.background };

  if (!booking.data) {
    return (
      <View style={[frame, { flex: 1 }]}>
        <BackHeader title="Booking" />
        {booking.isError ? <ErrorView error={booking.error} onRetry={() => { void booking.refetch(); }} /> : <LoadingView label="Loading the booking" />}
      </View>
    );
  }
  const b = booking.data;
  const pill = STATUS_PILL[b.status];
  const name = customerName(b.customer);
  const busy = busyId === b.id;
  const reason = b.decline_reason ?? b.cancel_reason;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.colors.background }} contentContainerStyle={[frame, { paddingBottom: insets.bottom + theme.spacing.xl, gap: 16 }]}>
      <BackHeader title={`Booking ${b.code}`} />
      <StatusPill label={pill.label} tone={pill.tone} />
      {b.status === 'requested' ? (
        <RequestCard
          booking={b}
          now={now}
          busy={busy}
          error={errors[b.id]}
          onAccept={() => { void run(b.id, { kind: 'accept' }); }}
          onDecline={(declineReason) => { void run(b.id, { kind: 'decline', reason: declineReason }); }}
          onMessage={onMessage}
        />
      ) : (
        <>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Avatar uri={null} name={name} size={52} />
            <AppText variant="subtitle" style={{ flex: 1, color: theme.colors.textPrimary }}>{name}</AppText>
          </View>
          <Card>
            <InfoRow label="Service" value={b.service_name} />
            <InfoRow label="When" value={formatWhen(b.start_at)} />
            <InfoRow label="Where" value={b.address} />
            <InfoRow label="You earn" value={formatMaybePrice(b.artist_earning_paise)} strong tint={theme.colors.brand} />
          </Card>
          {b.note ? (
            <View style={{ borderRadius: theme.radii.md, backgroundColor: theme.colors.washTop, padding: 12 }}>
              <AppText variant="caption" style={{ color: theme.colors.textMuted }}>Customer’s note</AppText>
              <AppText variant="body" style={{ color: theme.colors.textSecondary }}>{b.note}</AppText>
            </View>
          ) : null}
          {reason ? <AppText variant="body" style={{ color: theme.colors.textSecondary }}>{`Reason: ${reason}`}</AppText> : null}
          <AppButton label="Message customer" variant="secondary" loading={isOpeningChat} onPress={onMessage} />
          {b.status === 'confirmed' ? (
            <AppButton
              label="Mark completed"
              disabled={now < Date.parse(b.start_at)}
              loading={busy}
              onPress={() => { void run(b.id, { kind: 'complete' }); }}
            />
          ) : null}
          {errors[b.id] ? <AppText variant="caption" style={{ color: theme.colors.error }}>{errors[b.id]}</AppText> : null}
        </>
      )}
    </ScrollView>
  );
}
