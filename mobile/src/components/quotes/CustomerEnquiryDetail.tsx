import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppButton } from '../common/AppButton';
import { AppText } from '../common/AppText';
import { Avatar } from '../common/Avatar';
import { BackHeader } from '../common/BackHeader';
import { StatusPill } from '../common/StatusPill';
import { ErrorView, LoadingView } from '../common/StateViews';
import { EnquiryAsk } from './EnquiryAsk';
import { QuoteCard } from './QuoteCard';
import { useTheme } from '../../core/theme/theme-provider';
import { useCancelEnquiry, useEnquiry } from '../../hooks/quotes/quotes';
import { errorMessage } from '../../core/api/error-message';
import { CUSTOMER_ENQUIRY_PILL, canWithdraw } from '../../utils/quotes/status';
import type { Enquiry } from '../../types/quotes/quotes';

interface CustomerEnquiryDetailProps {
  enquiryId: string;
  /** Opens Accept & pick a time. */
  onAccept: () => void;
  onOpenBooking: (bookingId: string) => void;
}

/** What the customer asked, the artist's quote (accept or withdraw), or how it ended. */
export function CustomerEnquiryDetail({ enquiryId, onAccept, onOpenBooking }: CustomerEnquiryDetailProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const enquiry = useEnquiry(enquiryId);
  const frame = { paddingTop: insets.top + theme.spacing.sm, paddingHorizontal: theme.spacing.md, backgroundColor: theme.colors.background };

  if (!enquiry.data) {
    return (
      <View style={[frame, { flex: 1 }]}>
        <BackHeader title="Quote request" />
        {enquiry.isError ? <ErrorView error={enquiry.error} onRetry={() => { void enquiry.refetch(); }} /> : <LoadingView label="Loading the quote request" />}
      </View>
    );
  }
  const e = enquiry.data;
  const pill = CUSTOMER_ENQUIRY_PILL[e.status];

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.colors.background }} contentContainerStyle={[frame, { paddingBottom: insets.bottom + theme.spacing.xl, gap: 16 }]}>
      <BackHeader title="Quote request" />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Avatar uri={e.artist.photo_url} name={e.artist.business_name} size={52} />
        <View style={{ flex: 1, gap: 4 }}>
          <AppText variant="subtitle" style={{ color: theme.colors.textPrimary }}>{e.artist.business_name}</AppText>
          <StatusPill label={pill.label} tone={pill.tone} />
        </View>
      </View>
      <EnquiryAsk enquiry={e} />
      {e.status === 'open' ? <AppText variant="body" style={{ color: theme.colors.textSecondary }}>{`Waiting for ${e.artist.business_name} to send a quote.`}</AppText> : null}
      {e.quote ? (
        <QuoteCard quote={e.quote}>
          {e.status === 'quoted' ? <View style={{ marginTop: 10 }}><AppButton label="Accept & pick a time" onPress={onAccept} /></View> : null}
        </QuoteCard>
      ) : null}
      {e.status === 'declined' ? <AppText variant="body" style={{ color: theme.colors.textSecondary }}>{e.decline_reason ? `Declined: ${e.decline_reason}` : `${e.artist.business_name} can’t take this one.`}</AppText> : null}
      {e.status === 'expired' ? <AppText variant="body" style={{ color: theme.colors.textSecondary }}>This request has expired.</AppText> : null}
      {e.status === 'accepted' && e.booking_id ? <AppButton label="View booking" onPress={() => onOpenBooking(e.booking_id ?? '')} /> : null}
      {canWithdraw(e) ? <Withdraw enquiry={e} /> : null}
    </ScrollView>
  );
}

/** Withdraw enquiry, with a confirm step. */
function Withdraw({ enquiry }: { enquiry: Enquiry }) {
  const theme = useTheme();
  const cancel = useCancelEnquiry();
  const [confirming, setConfirming] = useState(false);
  return (
    <View style={{ gap: 8 }}>
      {confirming ? (
        <>
          <AppText variant="body" style={{ color: theme.colors.textSecondary }}>{`Withdraw this request? ${enquiry.artist.business_name} won’t be able to quote on it.`}</AppText>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <View style={{ flex: 1 }}><AppButton label="Keep it" variant="secondary" disabled={cancel.isPending} onPress={() => setConfirming(false)} /></View>
            <View style={{ flex: 1 }}><AppButton label="Yes, withdraw" loading={cancel.isPending} onPress={() => cancel.mutate(enquiry.id, { onSuccess: () => setConfirming(false) })} /></View>
          </View>
        </>
      ) : (
        <AppButton label="Withdraw enquiry" variant="ghost" onPress={() => setConfirming(true)} />
      )}
      {cancel.error ? <AppText variant="caption" accessibilityRole="alert" style={{ color: theme.colors.error }}>{errorMessage(cancel.error)}</AppText> : null}
    </View>
  );
}
