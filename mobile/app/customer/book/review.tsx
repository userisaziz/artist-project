import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '../../../src/components/common/AppText';
import { AppButton } from '../../../src/components/common/AppButton';
import { AppTextField } from '../../../src/components/common/AppTextField';
import { BackHeader } from '../../../src/components/common/BackHeader';
import { Card } from '../../../src/components/common/Card';
import { ErrorView, LoadingView } from '../../../src/components/common/StateViews';
import { useTheme } from '../../../src/core/theme/theme-provider';
import { useArtistPublic, directoryKeys } from '../../../src/hooks/directory/directory';
import { useBookingWrite } from '../../../src/hooks/bookings/bookings';
import { AddressPicker } from '../../../src/components/common/AddressPicker';
import { useAddressBook } from '../../../src/hooks/addresses/addresses';
import { useBookingFlow } from '../../../src/context/bookings/flow-context';
import { Breakdown } from '../../../src/components/bookings/Breakdown';
import { DEPOSIT_PERCENT, IN_APP_PAYMENTS, freeCancelUntil, priceBreakdown } from '../../../src/utils/bookings/pricing';
import { formatWhen } from '../../../src/utils/common/time';
import { useNow } from '../../../src/hooks/common/use-now';
import { formatPrice } from '../../../src/utils/common/format';
import { createBooking } from '../../../src/api/bookings/bookings';
import { errorMessage } from '../../../src/core/api/error-message';
import { ApiError } from '../../../src/core/api/types';

const MAX_ADDRESS = 300;
const MAX_NOTE = 500;
const TAKEN = 'That time was just taken. Pick another slot.';

const TITLE = IN_APP_PAYMENTS ? 'Review & pay' : 'Review & request';

// Spec §2 Review (step 2 of 2): summary, address and note, the breakdown, then the deposit, or (phase 1, no
// in-app payments) the request, with the artist paid directly after the service.
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
  const book = useAddressBook();
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [remember, setRemember] = useState(true);
  const [note, setNote] = useState('');
  const [addressError, setAddressError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);
  const service = artist.data?.services.find((s) => s.id === serviceId);

  if (!artist.data || !service) {
    return (
      <View style={{ flex: 1, paddingTop: insets.top + theme.spacing.sm, paddingHorizontal: theme.spacing.md, backgroundColor: theme.colors.background }}>
        <BackHeader title={TITLE} step="Step 2 of 2" />
        {artist.isError ? <ErrorView error={artist.error} onRetry={() => { void artist.refetch(); }} /> : <LoadingView />}
      </View>
    );
  }
  const money = priceBreakdown(service.price_paise, IN_APP_PAYMENTS ? DEPOSIT_PERCENT : 0, IN_APP_PAYMENTS);
  const start = Date.parse(startAt);
  const refundUntil = freeCancelUntil(start);
  const cancelLine = !IN_APP_PAYMENTS
    ? 'Nothing is paid in the app. You can cancel any time before the start.'
    : refundUntil > now
      ? `Free cancellation until ${formatWhen(refundUntil)}`
      : 'This starts within 72 hours, so the deposit isn’t refundable if you cancel.';

  const pay = async () => {
    if (paying) return;
    if (!address.trim()) { setAddressError('Add the address where the artist should come.'); return; }
    setPaying(true);
    setError(null);
    try {
      const booking = await write(() => createBooking({ artist_id: artistId, service_id: serviceId, start_at: startAt, address: address.trim(), note: note.trim() || null }));
      book.afterUse(address, pickedId, remember);
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
        <BackHeader title={TITLE} step="Step 2 of 2" />
        <Card>
          <AppText variant="subtitle" style={{ color: theme.colors.textPrimary }}>{service.name}</AppText>
          <AppText variant="caption" style={{ color: theme.colors.textMuted }}>{artist.data.business_name}</AppText>
          <AppText variant="label" style={{ color: theme.colors.textSecondary, marginTop: 8 }}>{formatWhen(startAt)}</AppText>
        </Card>
        <AddressPicker
          choices={book.choices}
          pickedId={pickedId}
          onPick={(c) => { setPickedId(c.id); setAddress(c.address); setAddressError(null); }}
          remember={remember}
          onRememberChange={setRemember}
        />
        <AppTextField
          label="Address"
          placeholder="House, street and area"
          value={address}
          onChangeText={(v) => { setAddress(v); setPickedId(null); setAddressError(null); }}
          maxLength={MAX_ADDRESS}
          error={addressError}
        />
        <AppTextField label="Note for the artist (optional)" placeholder="Anything they should know" value={note} onChangeText={setNote} maxLength={MAX_NOTE} />
        <Card>
          <Breakdown money={money} />
        </Card>
        <View style={{ gap: 4 }}>
          <AppText variant="caption" style={{ color: theme.colors.confirmedInk }}>{cancelLine}</AppText>
          <AppText variant="caption" style={{ color: theme.colors.textMuted }}>
            {IN_APP_PAYMENTS ? 'Test mode: no real payment is taken.' : `Pay ${artist.data.business_name} directly after the service.`}
          </AppText>
        </View>
        {error ? <AppText variant="caption" style={{ color: theme.colors.error }}>{error}</AppText> : null}
      </ScrollView>
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: theme.spacing.md, paddingTop: 12, paddingBottom: insets.bottom + 12, backgroundColor: theme.colors.surface, borderTopWidth: 1, borderTopColor: theme.colors.separator }}>
        <AppButton label={IN_APP_PAYMENTS ? `Pay deposit · ${formatPrice(money.deposit_paise)}` : 'Request booking'} loading={paying} onPress={() => { void pay(); }} />
      </View>
    </View>
  );
}
