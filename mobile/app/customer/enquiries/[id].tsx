import { useLocalSearchParams, useRouter } from 'expo-router';
import { CustomerEnquiryDetail } from '../../../src/components/quotes/CustomerEnquiryDetail';

// A quote request, from My quotes or a notification.
export default function EnquiryDetail() {
  const router = useRouter();
  const { id = '' } = useLocalSearchParams<{ id: string }>();
  return (
    <CustomerEnquiryDetail
      enquiryId={id}
      onAccept={() => router.push({ pathname: '/customer/enquiries/[id]/accept', params: { id } })}
      onOpenBooking={(bookingId) => router.push({ pathname: '/customer/booking/[id]', params: { id: bookingId } })}
    />
  );
}
