import { useState } from 'react';
import { SlotGrid } from '../common/SlotGrid';
import { useAvailability } from '../../hooks/directory/directory';
import { useNow } from '../../hooks/common/use-now';
import { addDays, istDateKey } from '../../utils/common/time';

const STRIP_DAYS = 14;

interface SlotPickerProps {
  artistId: string;
  serviceId: string;
  /** The picked start (ISO), or null. */
  value: string | null;
  onChange: (startAt: string | null) => void;
}

/** A 14-day strip and the day's hourly IST slots for one service; taken ones are struck through. Booking and
 *  rescheduling both use it. Changing the day clears the pick. */
export function SlotPicker({ artistId, serviceId, value, onChange }: SlotPickerProps) {
  const today = istDateKey(useNow());
  const [date, setDate] = useState(today);
  const slots = useAvailability(artistId, date, serviceId);
  const days = Array.from({ length: STRIP_DAYS }, (_, i) => addDays(today, i));
  return <SlotGrid days={days} date={date} onDateChange={setDate} slots={slots} value={value} onChange={onChange} />;
}
