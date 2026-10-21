import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArtistEnquiryDetail } from '../../../src/components/quotes/ArtistEnquiryDetail';

// An enquiry, from Enquiries or a notification.
export default function ArtistEnquiry() {
  const router = useRouter();
  const { id = '' } = useLocalSearchParams<{ id: string }>();
  return <ArtistEnquiryDetail enquiryId={id} onOpenBooking={(bookingId) => router.push({ pathname: '/artist/booking/[id]', params: { id: bookingId } })} />;
}
