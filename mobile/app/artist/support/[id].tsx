import { useLocalSearchParams } from 'expo-router';
import { SupportThread } from '../../../src/components/support/SupportThread';

// One support ticket and its thread with Atelier support.
export default function SupportTicketScreen() {
  const { id = '' } = useLocalSearchParams<{ id: string }>();
  return <SupportThread ticketId={id} />;
}
