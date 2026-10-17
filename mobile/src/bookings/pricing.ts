// Booking money and slot rules (spec Decisions + §1.2). Shared by the mock API and the screens, and kept in
// lockstep with backend app/core/config.py: the server is the source of truth, these only preview and mirror it.
import { istDateKey, istDayStart } from '../core/lib/time';

export const PLATFORM_FEE_PAISE = 9_900;          // ₹99
export const FEE_WAIVER_FROM_PAISE = 2_500_000;   // fee waived at ₹25,000 and up
export const DEPOSIT_PERCENT = 30;
export const COMMISSION_PERCENT = 10;
export const ACCEPT_WINDOW_HOURS = 3;
export const FREE_CANCEL_HOURS = 72;
export const SLOT_LEAD_HOURS = 2;
export const SLOT_FIRST_HOUR = 9;
export const SLOT_LAST_HOUR = 17;
export const BOOKABLE_DAYS = 60;

const HOUR_MS = 3600_000;
const RUPEE = 100;

export interface PriceBreakdown {
  subtotal_paise: number;
  platform_fee_paise: number;
  total_paise: number;
  deposit_paise: number;
  balance_paise: number;
  commission_paise: number;
  artist_earning_paise: number;
}

export function priceBreakdown(subtotal: number): PriceBreakdown {
  const fee = subtotal >= FEE_WAIVER_FROM_PAISE ? 0 : PLATFORM_FEE_PAISE;
  const total = subtotal + fee;
  const deposit = Math.round((total * DEPOSIT_PERCENT) / (100 * RUPEE)) * RUPEE; // nearest whole rupee
  const commission = Math.round((subtotal * COMMISSION_PERCENT) / 100);
  return {
    subtotal_paise: subtotal, platform_fee_paise: fee, total_paise: total,
    deposit_paise: deposit, balance_paise: total - deposit,
    commission_paise: commission, artist_earning_paise: subtotal - commission,
  };
}

/** Hourly IST start times of a day, as ISO instants. */
export function slotStarts(dateKey: string): string[] {
  const midnight = istDayStart(dateKey);
  const out: string[] = [];
  for (let h = SLOT_FIRST_HOUR; h <= SLOT_LAST_HOUR; h++) out.push(new Date(midnight + h * HOUR_MS).toISOString());
  return out;
}

/** Half-open intervals [aStart, aEnd) and [bStart, bEnd). */
export function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd;
}

export interface Busy { start: number; end: number }

export function isSlotFree(start: number, durationMinutes: number, busy: Busy[], now: number): boolean {
  if (start - now < SLOT_LEAD_HOURS * HOUR_MS) return false;
  const end = start + durationMinutes * 60_000;
  return !busy.some((b) => overlaps(start, end, b.start, b.end));
}

/** GET /artists/{id}/availability `slots` for one IST day. */
export function availability(dateKey: string, durationMinutes: number, busy: Busy[], now: number) {
  return slotStarts(dateKey).map((start_at) => ({ start_at, available: isSlotFree(Date.parse(start_at), durationMinutes, busy, now) }));
}

/** Today (IST) up to BOOKABLE_DAYS ahead. */
export function isBookableDate(dateKey: string, now: number): boolean {
  const day = istDayStart(dateKey);
  if (Number.isNaN(day)) return false;
  const today = istDayStart(istDateKey(now));
  return day >= today && day <= today + BOOKABLE_DAYS * 24 * HOUR_MS;
}

/** A customer cancelling at least FREE_CANCEL_HOURS before the start gets the deposit back. */
export function refundDueOnCustomerCancel(start: number, now: number): boolean {
  return start - now >= FREE_CANCEL_HOURS * HOUR_MS;
}

/** The last moment a customer can cancel and still be refunded. */
export function freeCancelUntil(start: number): number {
  return start - FREE_CANCEL_HOURS * HOUR_MS;
}
