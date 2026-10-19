import { availability, isBookableDate, overlaps, priceBreakdown, refundDueOnCustomerCancel, slotStarts } from '../../utils/bookings/pricing';
import { istDayStart } from '../../utils/common/time';

const HOUR = 3600_000;

describe('priceBreakdown', () => {
  it('adds the ₹99 platform fee below ₹25,000 and takes a 30% deposit rounded to the rupee', () => {
    // ₹4,500 + ₹99 = ₹4,599 → 30% = ₹1,379.70 → ₹1,380
    expect(priceBreakdown(450_000)).toEqual({
      subtotal_paise: 450_000, platform_fee_paise: 9_900, total_paise: 459_900,
      deposit_paise: 138_000, balance_paise: 321_900, commission_paise: 45_000, artist_earning_paise: 405_000,
    });
  });

  it('waives the fee at exactly ₹25,000 and above', () => {
    expect(priceBreakdown(2_499_900).platform_fee_paise).toBe(9_900);
    const b = priceBreakdown(2_500_000);
    expect(b.platform_fee_paise).toBe(0);
    expect(b.total_paise).toBe(2_500_000);
    expect(b.deposit_paise).toBe(750_000);
  });

  it('rounds the deposit to the nearest rupee, half up', () => {
    // ₹1 + ₹99 = ₹100 → 30% = ₹30.00
    expect(priceBreakdown(100).deposit_paise).toBe(3_000);
    // ₹401 + ₹99 = ₹500 → ₹150; ₹406 → ₹505 → ₹151.50 → ₹152
    expect(priceBreakdown(40_600).deposit_paise).toBe(15_200);
    expect(priceBreakdown(40_600).deposit_paise % 100).toBe(0);
  });

  it('commission is 10% of the subtotal and the artist earns the rest', () => {
    const b = priceBreakdown(1_234_500);
    expect(b.commission_paise).toBe(123_450);
    expect(b.artist_earning_paise).toBe(1_111_050);
  });
});

describe('slots', () => {
  it('lists hourly IST starts from 09:00 to 17:00', () => {
    const starts = slotStarts('2026-10-20');
    expect(starts).toHaveLength(9);
    expect(starts[0]).toBe('2026-10-20T03:30:00.000Z'); // 09:00 IST
    expect(starts[8]).toBe('2026-10-20T11:30:00.000Z'); // 17:00 IST
  });

  it('overlaps uses half-open intervals', () => {
    expect(overlaps(0, 10, 10, 20)).toBe(false);
    expect(overlaps(0, 11, 10, 20)).toBe(true);
    expect(overlaps(12, 15, 10, 20)).toBe(true);
  });

  it('a slot is taken when its [start, start + duration) overlaps a busy booking', () => {
    const now = istDayStart('2026-10-19'); // the day before, midnight IST
    const busy = [{ start: Date.parse('2026-10-20T05:30:00.000Z'), end: Date.parse('2026-10-20T07:30:00.000Z') }]; // 11:00–13:00 IST
    const slots = availability('2026-10-20', 120, busy, now);
    const free = Object.fromEntries(slots.map((s) => [s.start_at, s.available]));
    expect(free['2026-10-20T03:30:00.000Z']).toBe(true);  // 09:00–11:00 touches, no overlap
    expect(free['2026-10-20T04:30:00.000Z']).toBe(false); // 10:00–12:00
    expect(free['2026-10-20T05:30:00.000Z']).toBe(false); // 11:00
    expect(free['2026-10-20T06:30:00.000Z']).toBe(false); // 12:00
    expect(free['2026-10-20T07:30:00.000Z']).toBe(true);  // 13:00, right after
  });

  it('a slot less than 2 hours away is unavailable', () => {
    const now = Date.parse('2026-10-20T04:00:00.000Z'); // 09:30 IST
    const slots = availability('2026-10-20', 60, [], now);
    const free = Object.fromEntries(slots.map((s) => [s.start_at, s.available]));
    expect(free['2026-10-20T05:30:00.000Z']).toBe(false); // 11:00 is 1.5h away
    expect(free['2026-10-20T06:00:00.000Z']).toBeUndefined();
    expect(free['2026-10-20T06:30:00.000Z']).toBe(true);  // 12:00 is 2.5h away
    expect(Date.parse('2026-10-20T06:00:00.000Z') - now).toBe(2 * HOUR);
  });

  it('bookable dates run from today to 60 days ahead (IST)', () => {
    const now = Date.parse('2026-10-19T20:00:00.000Z'); // 01:30 IST on the 20th
    expect(isBookableDate('2026-10-19', now)).toBe(false);
    expect(isBookableDate('2026-10-20', now)).toBe(true);
    expect(isBookableDate('2026-12-19', now)).toBe(true);  // +60
    expect(isBookableDate('2026-12-20', now)).toBe(false); // +61
    expect(isBookableDate('not-a-date', now)).toBe(false);
  });
});

describe('refunds', () => {
  it('a customer cancel at least 72h before the start is refunded; later is not', () => {
    const start = Date.parse('2026-10-25T05:30:00.000Z');
    expect(refundDueOnCustomerCancel(start, start - 72 * HOUR)).toBe(true);
    expect(refundDueOnCustomerCancel(start, start - 72 * HOUR + 1)).toBe(false);
  });
});

describe('without in-app payments (phase 1)', () => {
  it('takes no deposit and no platform fee: the service price is paid to the artist after the service', () => {
    const b = priceBreakdown(450_000, 0, false);
    expect([b.platform_fee_paise, b.total_paise, b.deposit_paise, b.balance_paise]).toEqual([0, 450_000, 0, 450_000]);
  });
});
