import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '../../../src/components/AppText';
import { AppButton } from '../../../src/components/AppButton';
import { AppTextField } from '../../../src/components/AppTextField';
import { BackHeader } from '../../../src/components/BackHeader';
import { Card } from '../../../src/components/Card';
import { ErrorView, LoadingView } from '../../../src/components/StateViews';
import { useTheme } from '../../../src/theme/theme-provider';
import { useArtistPublic, directoryKeys } from '../../../src/directory/queries';
import { useBookingWrite } from '../../../src/bookings/queries';
import { useBookingFlow } from '../../../src/bookings/flow-context';
import { Breakdown } from '../../../src/bookings/Breakdown';
import { freeCancelUntil, priceBreakdown } from '../../../src/bookings/pricing';
import { formatWhen } from '../../../src/bookings/time';
import { useNow } from '../../../src/bookings/use-now';
import { formatPrice } from '../../../src/artist/format';
import { createBooking } from '../../../src/api/endpoints/bookings';
import { errorMessage } from '../../../src/api/error-message';
import { ApiError } from '../../../src/api/types';

const MAX_ADDRESS = 300;
const MAX_NOTE = 500;
const TAKEN = 'That time was just taken. Pick another slot.';

// Spec §2 Review & pay (step 2 of 2): summary, address and note, the breakdown, then the (mocked) deposit.
export default function ReviewAndPay() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const client = useQueryClient();
  const write = useBookingWrite();
  const { setNotice } = useBookingFlow();
  const { artistId = '', serviceId = '', startAt = '' } = useLocalSearchParams<{ artistId: string; serviceId: string; startAt: string }>();
  const artist = useArtistPublic(artistId);
  const now = useNow();
  const [address, setAddress] = useState('');
  const [note, setNote] = useState('');
  const [addressError, setAddressError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);
  const service = artist.data?.services.find((s) => s.id === serviceId);

  if (!artist.data || !service) {
    return (
      <View style={{ flex: 1, paddingTop: insets.top + theme.spacing.sm, paddingHorizontal: theme.spacing.md, backgroundColor: theme.colors.background }}>
        <BackHeader title="Review & pay" step="Step 2 of 2" />
        {artist.isError ? <ErrorView error={artist.error} onRetry={() => { void artist.refetch(); }} /> : <LoadingView />}
      </View>
    );
  }
  const money = priceBreakdown(service.price_paise);
  const start = Date.parse(startAt);
  const refundUntil = freeCancelUntil(start);
  const cancelLine = refundUntil > now
    ? `Free cancellation until ${formatWhen(refundUntil)}`
    : 'This starts within 72 hours, so the deposit isn’t refundable if you cancel.';

  const pay = async () => {
    if (paying) return;
    if (!address.trim()) { setAddressError('Add the address where the artist should come.'); return; }
    setPaying(true);
    setError(null);
    try {
      const booking = await write(() => createBooking({ artist_id: artistId, service_id: serviceId, start_at: startAt, address: address.trim(), note: note.trim() || null }));
      router.replace({ pathname: '/customer/book/done', params: { id: booking.id } });
    } catch (e) {
      setPaying(false);
      if (e instanceof ApiError && e.code === 'conflict') {
        setNotice(e.message || TAKEN);
        await client.invalidateQueries({ queryKey: [...directoryKeys.all, 'availability'] });
        router.back(); // Date & time shows the notice over freshly fetched slots
        return;
      }
      setError(errorMessage(e));
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingTop: insets.top + theme.spacing.sm, paddingHorizontal: theme.spacing.md, paddingBottom: 120 + insets.bottom, gap: 16 }}>
        <BackHeader title="Review & pay" step="Step 2 of 2" />
        <Card>
          <AppText variant="subtitle" style={{ color: theme.colors.textPrimary }}>{service.name}</AppText>
          <AppText variant="caption" style={{ color: theme.colors.textMuted }}>{artist.data.business_name}</AppText>
          <AppText variant="label" style={{ color: theme.colors.textSecondary, marginTop: 8 }}>{formatWhen(startAt)}</AppText>
        </Card>
        <AppTextField
          label="Address"
          placeholder="House, street and area"
          value={address}
          onChangeText={(v) => { setAddress(v); setAddressError(null); }}
          maxLength={MAX_ADDRESS}
          error={addressError}
        />
        <AppTextField label="Note for the artist (optional)" placeholder="Anything they should know" value={note} onChangeText={setNote} maxLength={MAX_NOTE} />
        <Card>
          <Breakdown money={money} />
        </Card>
        <View style={{ gap: 4 }}>
          <AppText variant="caption" style={{ color: theme.colors.confirmedInk }}>{cancelLine}</AppText>
          <AppText variant="caption" style={{ color: theme.colors.textMuted }}>Test mode: no real payment is taken.</AppText>
        </View>
        {error ? <AppText variant="caption" style={{ color: theme.colors.error }}>{error}</AppText> : null}
      </ScrollView>
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: theme.spacing.md, paddingTop: 12, paddingBottom: insets.bottom + 12, backgroundColor: theme.colors.surface, borderTopWidth: 1, borderTopColor: theme.colors.separator }}>
        <AppButton label={`Pay deposit · ${formatPrice(money.deposit_paise)}`} loading={paying} onPress={() => { void pay(); }} />
      </View>
    </View>
  );
}
