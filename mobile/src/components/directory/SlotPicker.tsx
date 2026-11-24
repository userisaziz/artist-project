import { useState } from 'react';
import { SlotGrid } from '../common/SlotGrid';
import { useArtistPublic, useAvailability } from '../../hooks/directory/directory';
import { useNow } from '../../hooks/common/use-now';
import { addDays, istDateKey } from '../../utils/common/time';
import { BOOKABLE_DAYS } from '../../utils/bookings/pricing';

interface SlotPickerProps {
  artistId: string;
  serviceId: string;
  /** The picked start (ISO), or null. */
  value: string | null;
  onChange: (startAt: string | null) => void;
}

/** Every bookable day (today + BOOKABLE_DAYS, with a month calendar for the far ones) and the day's hourly IST
 *  slots for one service; taken ones are struck through. Opens on the artist's next free day rather than a
 *  fully booked today. Booking and rescheduling both use it. Changing the day clears the pick. */
export function SlotPicker({ artistId, serviceId, value, onChange }: SlotPickerProps) {
  const today = istDateKey(useNow());
  const days = Array.from({ length: BOOKABLE_DAYS + 1 }, (_, i) => addDays(today, i));
  const nextFree = useArtistPublic(artistId).data?.next_free_date;
  const [picked, setPicked] = useState<string | null>(null);
  const date = picked ?? (nextFree && days.includes(nextFree) ? nextFree : today);
  const slots = useAvailability(artistId, date, serviceId);
  return <SlotGrid days={days} date={date} onDateChange={setPicked} slots={slots} value={value} onChange={onChange} />;
}
