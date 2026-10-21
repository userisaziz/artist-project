import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { AcceptQuote } from '../../../../src/components/quotes/AcceptQuote';
import { useAddressBook } from '../../../../src/hooks/addresses/addresses';
import { bookingKeys } from '../../../../src/hooks/bookings/bookings';

// Quote → Accept & pick a time. The app layer composes quotes (the form), addresses (the address book) and
// bookings (the new confirmed booking's lists refresh, then its detail opens).
export default function AcceptQuoteScreen() {
  const router = useRouter();
  const client = useQueryClient();
  const book = useAddressBook();
  const { id = '' } = useLocalSearchParams<{ id: string }>();
  return (
    <AcceptQuote
      enquiryId={id}
      addressBook={book}
      onAccepted={(bookingId) => {
        void client.invalidateQueries({ queryKey: bookingKeys.all });
        router.replace({ pathname: '/customer/booking/[id]', params: { id: bookingId } });
      }}
    />
  );
}
