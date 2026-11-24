import type { ArtistDashboard } from '../../types/bookings/bookings';

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** 'Nov' for '2026-11'. */
export function shortMonth(month: string): string {
  return MONTHS_SHORT[Number(month.split('-')[1]) - 1] ?? month;
}

export type Trend = 'up' | 'down' | 'flat';

/** This month against last month, as a direction and a short label: '+24% vs last month'. */
export function monthChange(thisMonth: number, lastMonth: number): { trend: Trend; label: string } {
  if (!lastMonth) {
    return thisMonth ? { trend: 'up', label: 'First earnings vs last month' } : { trend: 'flat', label: 'No earnings yet this month' };
  }
  const pct = Math.round(((thisMonth - lastMonth) / lastMonth) * 100);
  if (pct === 0) return { trend: 'flat', label: 'Same as last month' };
  return { trend: pct > 0 ? 'up' : 'down', label: `${pct > 0 ? '+' : ''}${pct}% vs last month` };
}

export type AttentionKey = 'expiring' | 'reschedules' | 'enquiries';

export interface AttentionItem {
  key: AttentionKey;
  title: string;
  detail: string;
  /** urgent rows are amber; the rest take the brand tint. */
  urgent: boolean;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** What the artist should act on now, most urgent first. Empty when everything is answered. */
export function attentionItems(d: ArtistDashboard): AttentionItem[] {
  const items: AttentionItem[] = [];
  if (d.requests_expiring_soon) {
    items.push({
      key: 'expiring',
      title: `${plural(d.requests_expiring_soon, 'request expires', 'requests expire')} soon`,
      detail: 'Accept or decline before the client is refunded',
      urgent: true,
    });
  }
  if (d.reschedules_pending) {
    items.push({
      key: 'reschedules',
      title: `${plural(d.reschedules_pending, 'client wants', 'clients want')} a new time`,
      detail: 'Answer the reschedule request',
      urgent: true,
    });
  }
  if (d.enquiries_open) {
    items.push({
      key: 'enquiries',
      title: `${plural(d.enquiries_open, 'enquiry waits', 'enquiries wait')} for a quote`,
      detail: 'Send a price to turn it into a booking',
      urgent: false,
    });
  }
  return items;
}
