import { useState } from 'react';
import { SlotGrid } from '../common/SlotGrid';
import { useQuoteAvailability } from '../../hooks/quotes/quotes';
import { useNow } from '../../hooks/common/use-now';
import { addDays, istDateKey } from '../../utils/common/time';

const DAYS_AROUND_EVENT = 7;
const STRIP_DAYS = 2 * DAYS_AROUND_EVENT + 1;

interface QuoteSlotPickerProps {
  enquiryId: string;
  /** The event the quote is for; the strip opens on it. */
  eventDate: string;
  /** The picked start (ISO), or null. */
  value: string | null;
  onChange: (startAt: string | null) => void;
}

/** Open starts for a quote's duration: about a week either side of the event date (never before today), opening on it. */
export function QuoteSlotPicker({ enquiryId, eventDate, value, onChange }: QuoteSlotPickerProps) {
  const today = istDateKey(useNow());
  const opening = eventDate >= today ? eventDate : today;
  const [date, setDate] = useState(opening);
  const slots = useQuoteAvailability(enquiryId, date);
  const weekBefore = addDays(opening, -DAYS_AROUND_EVENT);
  const first = weekBefore > today ? weekBefore : today;
  const days = Array.from({ length: STRIP_DAYS }, (_, i) => addDays(first, i));
  return <SlotGrid days={days} date={date} onDateChange={setDate} slots={slots} value={value} onChange={onChange} />;
}
