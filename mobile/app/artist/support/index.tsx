import { useRouter } from 'expo-router';
import { HelpSupport } from '../../../src/components/support/HelpSupport';
import { useArtistBookings } from '../../../src/hooks/bookings/bookings';
import { formatDay, istDateKey } from '../../../src/utils/common/time';
import { customerName } from '../../../src/utils/bookings/status';
import type { ReportableBooking } from '../../../src/types/support/support';

const REPORTABLE = 3;

// Me → Help & support. The app layer composes the two features: the artist's latest bookings become the
// "What's it about?" choices.
export default function ArtistHelpAndSupport() {
  const router = useRouter();
  const upcoming = useArtistBookings('upcoming');
  const past = useArtistBookings('past');
  const bookings: ReportableBooking[] = [...(past.data?.pages[0]?.items ?? []), ...(upcoming.data?.pages[0]?.items ?? [])]
    .sort((a, b) => Date.parse(b.start_at) - Date.parse(a.start_at))
    .slice(0, REPORTABLE)
    .map((b) => ({ id: b.id, label: `${customerName(b.customer)} · ${formatDay(istDateKey(b.start_at))}` }));
  return <HelpSupport side="artist" bookings={bookings} onOpenTicket={(id) => router.push({ pathname: '/artist/support/[id]', params: { id } })} />;
}
