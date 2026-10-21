import { request } from '../../core/api/client';
import { withQuery } from '../../core/api/query-string';
import type { Page } from '../../core/api/types';
import type { ArtistBookingScope, ArtistDashboard, Booking, BookingInput, CustomerBookingScope, MonthEarnings } from '../../types/bookings/bookings';

// Customer bookings (spec §1.4, customer role).
export function createBooking(body: BookingInput) {
  return request<Booking>('/bookings', body, { auth: true });
}
export function listMyBookings(scope: CustomerBookingScope, cursor?: string | null, limit?: number) {
  return request<Page<Booking>>(withQuery('/bookings', { scope, cursor, limit }), undefined, { auth: true, method: 'GET' });
}
export function getBooking(id: string) {
  return request<Booking>(`/bookings/${encodeURIComponent(id)}`, undefined, { auth: true, method: 'GET' });
}
export function cancelBooking(id: string, reason?: string | null) {
  return request<Booking>(`/bookings/${encodeURIComponent(id)}/cancel`, { reason: reason || null }, { auth: true });
}

// Artist bookings (spec §1.5, approved artists).
export interface ArtistBookingFilter {
  scope?: ArtistBookingScope;
  from?: string; // IST dates, filter on start_at
  to?: string;
  limit?: number;
  cursor?: string | null;
}
export function listArtistBookings(filter: ArtistBookingFilter = {}) {
  return request<Page<Booking>>(withQuery('/artists/me/bookings', { ...filter }), undefined, { auth: true, method: 'GET' });
}
export function getArtistBooking(id: string) {
  return request<Booking>(`/artists/me/bookings/${encodeURIComponent(id)}`, undefined, { auth: true, method: 'GET' });
}
export function acceptBooking(id: string) {
  return request<Booking>(`/artists/me/bookings/${encodeURIComponent(id)}/accept`, undefined, { auth: true });
}
export function declineBooking(id: string, reason?: string | null) {
  return request<Booking>(`/artists/me/bookings/${encodeURIComponent(id)}/decline`, { reason: reason || null }, { auth: true });
}
export function completeBooking(id: string) {
  return request<Booking>(`/artists/me/bookings/${encodeURIComponent(id)}/complete`, undefined, { auth: true });
}
/** Completed bookings and earnings per IST month, newest first ('YYYY-MM'). */
export function getArtistEarnings(months: number) {
  return request<{ months: MonthEarnings[] }>(withQuery('/artists/me/earnings', { months }), undefined, { auth: true, method: 'GET' });
}
export function getArtistDashboard() {
  return request<ArtistDashboard>('/artists/me/dashboard', undefined, { auth: true, method: 'GET' });
}

/** Customer: ask to move a confirmed booking to another open start; the artist accepts or declines. */
export function requestReschedule(id: string, startAt: string) {
  return request<Booking>(`/bookings/${encodeURIComponent(id)}/reschedule`, { start_at: startAt }, { auth: true });
}
export function withdrawReschedule(id: string) {
  return request<Booking>(`/bookings/${encodeURIComponent(id)}/reschedule`, undefined, { auth: true, method: 'DELETE' });
}
/** Artist: answer a request to move a booking. */
export function acceptReschedule(id: string) {
  return request<Booking>(`/artists/me/bookings/${encodeURIComponent(id)}/reschedule/accept`, undefined, { auth: true });
}
export function declineReschedule(id: string, reason: string | null) {
  return request<Booking>(`/artists/me/bookings/${encodeURIComponent(id)}/reschedule/decline`, { reason }, { auth: true });
}
