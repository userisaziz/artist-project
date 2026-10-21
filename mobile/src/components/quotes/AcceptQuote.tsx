import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AddressPicker, type AddressBook } from '../common/AddressPicker';
import { AppButton } from '../common/AppButton';
import { AppText } from '../common/AppText';
import { AppTextField } from '../common/AppTextField';
import { BackHeader } from '../common/BackHeader';
import { Card } from '../common/Card';
import { ErrorView, LoadingView } from '../common/StateViews';
import { QuoteSlotPicker } from './QuoteSlotPicker';
import { useTheme } from '../../core/theme/theme-provider';
import { useAcceptQuote, useEnquiry, useRefreshQuoteSlots } from '../../hooks/quotes/quotes';
import { errorMessage } from '../../core/api/error-message';
import { ApiError } from '../../core/api/types';
import { formatDuration, formatPrice } from '../../utils/common/format';
import { formatWhen } from '../../utils/common/time';
import { MAX_ADDRESS, MAX_NOTE } from '../../utils/quotes/status';

const TITLE = 'Accept quote';

interface AcceptQuoteProps {
  enquiryId: string;
  /** The customer's saved addresses (supplied by the route). */
  addressBook: AddressBook;
  onAccepted: (bookingId: string) => void;
}

/** Accept a quote: pick an open start for its duration, where the artist should come, an optional note, then confirm. */
export function AcceptQuote({ enquiryId, addressBook, onAccepted }: AcceptQuoteProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const enquiry = useEnquiry(enquiryId);
  const accept = useAcceptQuote();
  const refreshSlots = useRefreshQuoteSlots(enquiryId);
  const [startAt, setStartAt] = useState<string | null>(null);
  const [address, setAddress] = useState('');
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [remember, setRemember] = useState(true);
  const [note, setNote] = useState('');
  const [addressError, setAddressError] = useState<string | null>(null);
  const e = enquiry.data;

  // Once accepted the cached enquiry turns 'accepted' just before the route moves on; keep the form until then.
  if (!e || !e.quote || (e.status !== 'quoted' && accept.isIdle)) {
    return (
      <View style={{ flex: 1, paddingTop: insets.top + theme.spacing.sm, paddingHorizontal: theme.spacing.md, backgroundColor: theme.colors.background }}>
        <BackHeader title={TITLE} />
        {enquiry.isError ? <ErrorView error={enquiry.error} onRetry={() => { void enquiry.refetch(); }} /> : null}
        {!e && !enquiry.isError ? <LoadingView label="Loading the quote" /> : null}
        {e ? <AppText variant="body" style={{ color: theme.colors.textSecondary, marginTop: 16 }}>This quote can’t be accepted any more.</AppText> : null}
      </View>
    );
  }
  const quote = e.quote;

  const confirm = () => {
    if (!startAt || accept.isPending) return;
    if (!address.trim()) { setAddressError('Add the address where the artist should come.'); return; }
    accept.mutate(
      { id: e.id, body: { start_at: startAt, address: address.trim(), note: note.trim() || null } },
      {
        onSuccess: (result) => {
          addressBook.afterUse(address, pickedId, remember);
          onAccepted(result.booking_id);
        },
        onError: (err) => {
          if (err instanceof ApiError && err.code === 'conflict') { setStartAt(null); void refreshSlots(); }
        },
      },
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingTop: insets.top + theme.spacing.sm, paddingHorizontal: theme.spacing.md, paddingBottom: 160 + insets.bottom, gap: 12 }}>
        <BackHeader title={TITLE} />
        <Card>
          <AppText variant="subtitle" style={{ color: theme.colors.textPrimary }}>{e.artist.business_name}</AppText>
          <AppText variant="caption" style={{ color: theme.colors.textMuted }}>{`${formatPrice(quote.price_paise)} · ${formatDuration(quote.duration_minutes)}`}</AppText>
        </Card>
        <QuoteSlotPicker enquiryId={e.id} eventDate={e.event_date} value={startAt} onChange={setStartAt} />
        <AddressPicker
          choices={addressBook.choices}
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
      </ScrollView>
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: theme.spacing.md, paddingTop: 12, paddingBottom: insets.bottom + 12, backgroundColor: theme.colors.surface, borderTopWidth: 1, borderTopColor: theme.colors.separator, gap: 8 }}>
        <AppText variant="subtitle" style={{ fontSize: 14.5, color: startAt ? theme.colors.textPrimary : theme.colors.textMuted }}>{startAt ? formatWhen(startAt) : 'Pick a time'}</AppText>
        {accept.error ? <AppText variant="caption" accessibilityRole="alert" style={{ color: theme.colors.error }}>{errorMessage(accept.error)}</AppText> : null}
        <AppButton label="Confirm booking" loading={accept.isPending} disabled={!startAt} onPress={confirm} />
      </View>
    </View>
  );
}
