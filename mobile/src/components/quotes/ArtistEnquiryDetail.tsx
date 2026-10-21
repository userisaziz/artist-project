import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppButton } from '../common/AppButton';
import { AppText } from '../common/AppText';
import { Avatar } from '../common/Avatar';
import { BackHeader } from '../common/BackHeader';
import { StatusPill } from '../common/StatusPill';
import { ErrorView, LoadingView } from '../common/StateViews';
import { DeclineEnquiry } from './DeclineEnquiry';
import { EnquiryAsk } from './EnquiryAsk';
import { QuoteCard } from './QuoteCard';
import { QuoteForm } from './QuoteForm';
import { useTheme } from '../../core/theme/theme-provider';
import { useArtistEnquiry } from '../../hooks/quotes/quotes';
import { ARTIST_ENQUIRY_PILL, canQuote, customerShortName } from '../../utils/quotes/status';

interface ArtistEnquiryDetailProps {
  enquiryId: string;
  onOpenBooking: (bookingId: string) => void;
}

/** One enquiry for the artist: what the customer asked, then a quote to send or update, or Decline. */
export function ArtistEnquiryDetail({ enquiryId, onOpenBooking }: ArtistEnquiryDetailProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const enquiry = useArtistEnquiry(enquiryId);
  const frame = { paddingTop: insets.top + theme.spacing.sm, paddingHorizontal: theme.spacing.md, backgroundColor: theme.colors.background };

  if (!enquiry.data) {
    return (
      <View style={[frame, { flex: 1 }]}>
        <BackHeader title="Enquiry" />
        {enquiry.isError ? <ErrorView error={enquiry.error} onRetry={() => { void enquiry.refetch(); }} /> : <LoadingView label="Loading the enquiry" />}
      </View>
    );
  }
  const e = enquiry.data;
  const pill = ARTIST_ENQUIRY_PILL[e.status];
  const name = customerShortName(e.customer);

  return (
    <ScrollView keyboardShouldPersistTaps="handled" style={{ flex: 1, backgroundColor: theme.colors.background }} contentContainerStyle={[frame, { paddingBottom: insets.bottom + theme.spacing.xl, gap: 16 }]}>
      <BackHeader title="Enquiry" />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Avatar uri={null} name={name} size={52} />
        <View style={{ flex: 1, gap: 4 }}>
          <AppText variant="subtitle" style={{ color: theme.colors.textPrimary }}>{name}</AppText>
          <StatusPill label={pill.label} tone={pill.tone} />
        </View>
      </View>
      <EnquiryAsk enquiry={e} />
      {canQuote(e) ? (
        <>
          <QuoteForm enquiry={e} />
          <DeclineEnquiry enquiryId={e.id} />
        </>
      ) : (
        <>
          {e.quote ? <QuoteCard quote={e.quote} title="Your quote" /> : null}
          {e.status === 'declined' ? <AppText variant="body" style={{ color: theme.colors.textSecondary }}>{e.decline_reason ? `You declined: ${e.decline_reason}` : 'You declined this enquiry.'}</AppText> : null}
          {e.status === 'cancelled' ? <AppText variant="body" style={{ color: theme.colors.textSecondary }}>The customer withdrew this enquiry.</AppText> : null}
          {e.status === 'expired' ? <AppText variant="body" style={{ color: theme.colors.textSecondary }}>This enquiry has expired.</AppText> : null}
          {e.status === 'accepted' && e.booking_id ? <AppButton label="View booking" onPress={() => onOpenBooking(e.booking_id ?? '')} /> : null}
        </>
      )}
    </ScrollView>
  );
}
