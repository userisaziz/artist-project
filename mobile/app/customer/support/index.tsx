import { useRouter } from 'expo-router';
import { HelpSupport } from '../../../src/components/support/HelpSupport';
import { useCustomerBookings } from '../../../src/hooks/bookings/bookings';
import { formatDay, istDateKey } from '../../../src/utils/common/time';
import type { ReportableBooking } from '../../../src/types/support/support';

const REPORTABLE = 3;

// Design "Help & support" (Profile → Help & support). The app layer composes the two features: the customer's
// latest bookings become the "What's it about?" choices.
export default function HelpAndSupport() {
  const router = useRouter();
  const upcoming = useCustomerBookings('upcoming');
  const past = useCustomerBookings('past');
  const bookings: ReportableBooking[] = [...(past.data?.pages[0]?.items ?? []), ...(upcoming.data?.pages[0]?.items ?? [])]
    .sort((a, b) => Date.parse(b.start_at) - Date.parse(a.start_at))
    .slice(0, REPORTABLE)
    .map((b) => ({ id: b.id, label: `${b.service_name} · ${formatDay(istDateKey(b.start_at))}` }));
  return <HelpSupport side="customer" bookings={bookings} onOpenTicket={(id) => router.push({ pathname: '/customer/support/[id]', params: { id } })} />;
}
