import { addDays, formatDay, istDateKey } from '../common/time';
import type { ChatBookingStatus, ChatMessage, ConversationBooking } from '../../types/chat/chat';

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;

const STAGE: Record<ChatBookingStatus, string> = {
  requested: 'Request',
  confirmed: 'Booked',
  completed: 'Completed',
  declined: 'Declined',
  expired: 'Expired',
  cancelled: 'Cancelled',
};

/** Inbox row time: 'now', '2m', '1h' within today (IST), then 'Yesterday', then 'Thu, 1 Oct'. */
export function inboxTime(at: string, now: number): string {
  const ago = Math.max(0, now - Date.parse(at)); // a clock-skewed future time reads as 'now'
  const day = istDateKey(at);
  const today = istDateKey(now);
  if (day === today) {
    if (ago < MINUTE_MS) return 'now';
    if (ago < HOUR_MS) return `${Math.floor(ago / MINUTE_MS)}m`;
    return `${Math.floor(ago / HOUR_MS)}h`;
  }
  return day === addDays(today, -1) ? 'Yesterday' : formatDay(day);
}

/** Thread separator for an IST day: 'Today', 'Yesterday' or 'Sat, 3 Oct'. */
export function dayLabel(dateKey: string, now: number): string {
  const today = istDateKey(now);
  if (dateKey === today) return 'Today';
  return dateKey === addDays(today, -1) ? 'Yesterday' : formatDay(dateKey);
}

/** 'Request · Fri, 9 Oct': the booking the conversation is about. */
export function bookingTag(booking: ConversationBooking): string {
  return `${STAGE[booking.status]} · ${formatDay(istDateKey(booking.start_at))}`;
}

export type ThreadRow = { kind: 'message'; key: string; message: ChatMessage } | { kind: 'day'; key: string; label: string };

/** Newest-first messages → rows for an inverted list, with a day separator above each IST day's first message. */
export function threadRows(messages: ChatMessage[], now: number): ThreadRow[] {
  return messages.flatMap((message, i): ThreadRow[] => {
    const day = istDateKey(message.created_at);
    const older = messages[i + 1];
    const row: ThreadRow = { kind: 'message', key: message.id, message };
    if (older && istDateKey(older.created_at) === day) return [row];
    return [row, { kind: 'day', key: `day-${day}`, label: dayLabel(day, now) }];
  });
}
