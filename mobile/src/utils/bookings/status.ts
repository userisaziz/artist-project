import type { BookingStatus } from '../../core/api/types';
import type { PillTone } from '../../components/common/StatusPill';

/** Spec §2 Bookings tab pills. */
export const STATUS_PILL: Record<BookingStatus, { label: string; tone: PillTone }> = {
  requested: { label: 'Awaiting confirmation', tone: 'pending' },
  confirmed: { label: 'Confirmed', tone: 'confirmed' },
  completed: { label: 'Completed', tone: 'brand' },
  declined: { label: 'Declined', tone: 'neutral' },
  expired: { label: 'Expired', tone: 'neutral' },
  cancelled: { label: 'Cancelled', tone: 'neutral' },
};

export function customerName(c: { first_name: string | null; last_name: string | null }): string {
  return [c.first_name, c.last_name].filter(Boolean).join(' ') || 'Customer';
}
