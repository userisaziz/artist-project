import { bookingTag, dayLabel, inboxTime, threadRows } from '../../utils/chat/format';

// 2026-10-09 14:30 IST
const NOW = Date.parse('2026-10-09T09:00:00Z');

it('inbox times read as minutes, hours, Yesterday, then a date', () => {
  expect(inboxTime('2026-10-09T08:59:40Z', NOW)).toBe('now');
  expect(inboxTime('2026-10-09T08:58:00Z', NOW)).toBe('2m');
  expect(inboxTime('2026-10-09T08:00:00Z', NOW)).toBe('1h');
  expect(inboxTime('2026-10-08T12:00:00Z', NOW)).toBe('Yesterday');
  expect(inboxTime('2026-10-01T12:00:00Z', NOW)).toBe('Thu, 1 Oct');
});

it('thread day separators say Today, Yesterday or the date (IST)', () => {
  expect(dayLabel('2026-10-09', NOW)).toBe('Today');
  expect(dayLabel('2026-10-08', NOW)).toBe('Yesterday');
  expect(dayLabel('2026-10-03', NOW)).toBe('Sat, 3 Oct');
});

it('the booking tag names the stage and the IST day', () => {
  const base = { id: 'b1', code: 'BK-1', service_name: 'Bridal', start_at: '2026-10-09T05:30:00Z' };
  expect(bookingTag({ ...base, status: 'requested' })).toBe('Request · Fri, 9 Oct');
  expect(bookingTag({ ...base, status: 'confirmed' })).toBe('Booked · Fri, 9 Oct');
  expect(bookingTag({ ...base, status: 'cancelled' })).toBe('Cancelled · Fri, 9 Oct');
});

it('thread rows put a day separator above each day’s first message (inverted list order)', () => {
  const msg = (id: string, at: string) => ({ id, sender: 'customer' as const, text: id, created_at: at, moderation: null });
  const rows = threadRows([msg('c', '2026-10-09T08:00:00Z'), msg('b', '2026-10-09T07:00:00Z'), msg('a', '2026-10-08T07:00:00Z')], NOW);
  expect(rows.map((r) => (r.kind === 'day' ? r.label : r.message.id))).toEqual(['c', 'b', 'Today', 'a', 'Yesterday']);
});
