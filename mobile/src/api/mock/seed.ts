import type { BookingStatus, User } from '../types';
import type { MockArtists, MockProfile } from './artist';
import type { MockBookings, MockBooking } from './bookings';
import { SEED_ARTISTS, SEED_CUSTOMERS } from './directory-seed';
import { ACCEPT_WINDOW_HOURS, priceBreakdown } from '../../bookings/pricing';
import { addDays, istDateKey, istDayStart } from '../../bookings/time';

const HOUR_MS = 3600_000;
const DAY_MS = 24 * HOUR_MS;
const SEED_ADDRESSES = ['Koramangala 5th Block, Bangalore', 'Indiranagar 100 Ft Road, Bangalore', 'Bandra West, Mumbai'];

function seedUser(id: string, phone: string, first_name: string, last_name: string | null, role: 'customer' | 'artist'): User {
  return {
    id, phone, roles: [role], active_role: role, is_phone_verified: true, first_name, last_name,
    email: null, avatar_url: null, whatsapp_booking_updates: true, is_onboarded: true,
  };
}

/** `hour`:00 IST, `days` from today (IST). */
const atHour = (now: number, days: number, hour: number) => istDayStart(addDays(istDateKey(now), days)) + hour * HOUR_MS;

function seedBooking(bookings: MockBookings, artist: MockProfile, customerId: string, start: number, status: BookingStatus, now: number, serviceIndex = 0): MockBooking {
  const service = artist.services[serviceIndex % artist.services.length];
  const created = Math.min(now, start) - DAY_MS;
  const done = status === 'completed';
  return bookings.insert({
    status, customerId, artistId: artist.id, serviceId: service.id, serviceName: service.name, durationMinutes: service.duration_minutes,
    start, end: start + service.duration_minutes * 60_000, address: SEED_ADDRESSES[serviceIndex % SEED_ADDRESSES.length],
    note: status === 'requested' ? 'Please keep the palms lighter.' : null, money: priceBreakdown(service.price_paise),
    depositPaidAt: created, expiresAt: status === 'requested' ? now + ACCEPT_WINDOW_HOURS * HOUR_MS : created + ACCEPT_WINDOW_HOURS * HOUR_MS,
    respondedAt: status === 'requested' ? null : created + HOUR_MS, cancelledAt: null,
    completedAt: done ? start + service.duration_minutes * 60_000 : null, cancelledBy: null, declineReason: null, cancelReason: null,
    refundDue: null, createdAt: status === 'requested' ? now : created,
  });
}

/**
 * Spec §5 seed: six approved, sign-in-able artists (Priya first), two customers, and a few bookings per artist:
 * past completed ones, an upcoming confirmed one and, for all but Priya, a fresh request.
 * Priya gets no request so artist tests start from a known, empty request list.
 */
export function seedMarketplace(users: Map<string, User>, artists: MockArtists, bookings: MockBookings, now: number) {
  const customers = SEED_CUSTOMERS.map((c, i) => {
    const user = seedUser(`mock-user-seed-customer-${i + 1}`, c.phone, c.first_name, c.last_name, 'customer');
    users.set(c.phone, user);
    return user;
  });
  SEED_ARTISTS.forEach((a, i) => {
    const user = seedUser(`mock-user-seed-artist-${i + 1}`, a.phone, a.first_name, null, 'artist');
    users.set(a.phone, user);
    const profile = artists.seed(user.id, a, new Date(now - (i + 1) * 7 * DAY_MS).toISOString());
    for (let k = 0; k < (i % 3) + 1; k++) seedBooking(bookings, profile, customers[k % 2].id, atHour(now, -7 * (k + 1), 11), 'completed', now, k);
    if (i === 0) {
      seedBooking(bookings, profile, customers[0].id, atHour(now, 8, 16), 'confirmed', now);
      return;
    }
    seedBooking(bookings, profile, customers[0].id, atHour(now, 5 + i, 10), 'confirmed', now, 1);
    seedBooking(bookings, profile, customers[1].id, atHour(now, 2 + i, 14), 'requested', now);
  });
}
