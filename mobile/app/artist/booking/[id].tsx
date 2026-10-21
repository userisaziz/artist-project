import { useLocalSearchParams } from 'expo-router';
import { ArtistBookingDetail } from '../../../src/components/bookings/ArtistBookingDetail';
import { useChatOpener } from '../../../src/hooks/chat/chat';

// A booking, from Bookings, Home, Calendar or a notification.
export default function ArtistBooking() {
  const { id = '' } = useLocalSearchParams<{ id: string }>();
  const chat = useChatOpener('artist');
  return <ArtistBookingDetail bookingId={id} onMessage={() => { void chat.open(id); }} isOpeningChat={chat.openingId === id} />;
}
