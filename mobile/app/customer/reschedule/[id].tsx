import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '../../../src/components/common/AppText';
import { AppButton } from '../../../src/components/common/AppButton';
import { BackHeader } from '../../../src/components/common/BackHeader';
import { ErrorView, LoadingView } from '../../../src/components/common/StateViews';
import { SlotPicker } from '../../../src/components/directory/SlotPicker';
import { useTheme } from '../../../src/core/theme/theme-provider';
import { useBooking, useBookingWrite } from '../../../src/hooks/bookings/bookings';
import { useStillAvailable } from '../../../src/hooks/directory/directory';
import { requestReschedule } from '../../../src/api/bookings/bookings';
import { errorMessage } from '../../../src/core/api/error-message';
import { formatWhen } from '../../../src/utils/common/time';

// Booking → Change time: pick a new open start for the same service; the artist accepts or declines it.
// The app layer composes bookings (the request) and directory (the slot picker).
export default function RescheduleBooking() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id = '' } = useLocalSearchParams<{ id: string }>();
  const booking = useBooking(id);
  const write = useBookingWrite();
  const [startAt, setStartAt] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const b = booking.data;
  const chosen = useStillAvailable(b?.artist.id ?? '', b?.service_id ?? '', startAt);

  if (!b || !b.service_id) {
    return (
      <View style={{ flex: 1, paddingTop: insets.top + theme.spacing.sm, paddingHorizontal: theme.spacing.md, backgroundColor: theme.colors.background }}>
        <BackHeader title="Change time" />
        {booking.isError ? <ErrorView error={booking.error} onRetry={() => { void booking.refetch(); }} /> : null}
        {b && !b.service_id ? <AppText variant="body" style={{ color: theme.colors.textSecondary, marginTop: 16 }}>This service is no longer offered, so the booking can’t be moved. Message the artist instead.</AppText> : null}
        {!b && !booking.isError ? <LoadingView /> : null}
      </View>
    );
  }
  const same = chosen === b.start_at;

  const send = async () => {
    if (!chosen || same || sending) return;
    setSending(true);
    setError(null);
    try {
      await write(() => requestReschedule(b.id, chosen));
      router.back();
    } catch (e) {
      setError(errorMessage(e));
      setSending(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + theme.spacing.sm, paddingHorizontal: theme.spacing.md, paddingBottom: 140 + insets.bottom }}>
        <BackHeader title="Change time" />
        <AppText variant="body" style={{ color: theme.colors.textSecondary, marginTop: 8 }}>{`${b.service_name} with ${b.artist.business_name}`}</AppText>
        <AppText variant="caption" style={{ color: theme.colors.textMuted, marginTop: 4 }}>{`Now booked for ${formatWhen(b.start_at)}. It stays booked until ${b.artist.business_name} accepts the new time.`}</AppText>
        <SlotPicker artistId={b.artist.id} serviceId={b.service_id} value={startAt} onChange={setStartAt} />
      </ScrollView>
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: theme.spacing.md, paddingTop: 12, paddingBottom: insets.bottom + 12, backgroundColor: theme.colors.surface, borderTopWidth: 1, borderTopColor: theme.colors.separator, gap: 8 }}>
        <AppText variant="subtitle" style={{ fontSize: 14.5, color: chosen && !same ? theme.colors.textPrimary : theme.colors.textMuted }}>
          {!chosen ? 'Pick a new time' : same ? 'That’s the current time' : formatWhen(chosen)}
        </AppText>
        {error ? <AppText variant="caption" accessibilityRole="alert" style={{ color: theme.colors.error }}>{error}</AppText> : null}
        <AppButton label="Ask to move" loading={sending} disabled={!chosen || same} onPress={() => { void send(); }} />
      </View>
    </View>
  );
}
