import { useCallback } from 'react';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import * as bookingsApi from '../api/endpoints/bookings';
import type { ArtistBookingScope, Booking, CustomerBookingScope } from '../core/api/types';
import { useAuth } from '../auth/auth-provider';
import { directoryKeys } from '../directory/queries';

const PAGE_SIZE = 20;
const CALENDAR_PAGE = 100;

// Keyed by user id, so another account on the device never sees cached bookings.
export const bookingKeys = {
  all: ['bookings'] as const,
  customer: (userId: string | undefined, scope: CustomerBookingScope) => ['bookings', 'customer', userId, scope] as const,
  detail: (userId: string | undefined, id: string) => ['bookings', 'detail', userId, id] as const,
  artist: (userId: string | undefined, scope: ArtistBookingScope) => ['bookings', 'artist', userId, scope] as const,
  range: (userId: string | undefined, from: string, to: string) => ['bookings', 'artist', userId, 'range', from, to] as const,
  dashboard: (userId: string | undefined) => ['bookings', 'artist', userId, 'dashboard'] as const,
};

export function useCustomerBookings(scope: CustomerBookingScope) {
  const { user } = useAuth();
  return useInfiniteQuery({
    queryKey: bookingKeys.customer(user?.id, scope),
    queryFn: ({ pageParam }) => bookingsApi.listMyBookings(scope, pageParam, PAGE_SIZE),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.next_cursor,
    enabled: !!user,
  });
}

export function useBooking(id: string) {
  const { user } = useAuth();
  return useQuery({ queryKey: bookingKeys.detail(user?.id, id), queryFn: () => bookingsApi.getBooking(id), enabled: !!user && !!id });
}

export function useArtistBookings(scope: ArtistBookingScope) {
  const { user } = useAuth();
  return useInfiniteQuery({
    queryKey: bookingKeys.artist(user?.id, scope),
    queryFn: ({ pageParam }) => bookingsApi.listArtistBookings({ scope, cursor: pageParam, limit: PAGE_SIZE }),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.next_cursor,
    enabled: !!user,
  });
}

/** Every booking (any status) starting between two IST dates, all pages: the calendar's month. */
export function useArtistBookingsInRange(from: string, to: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: bookingKeys.range(user?.id, from, to),
    queryFn: async () => {
      const all: Booking[] = [];
      let cursor: string | null = null;
      do {
        const page = await bookingsApi.listArtistBookings({ from, to, cursor, limit: CALENDAR_PAGE });
        all.push(...page.items);
        cursor = page.next_cursor;
      } while (cursor);
      return all;
    },
    enabled: !!user,
  });
}

export function useArtistDashboard() {
  const { user } = useAuth();
  return useQuery({ queryKey: bookingKeys.dashboard(user?.id), queryFn: bookingsApi.getArtistDashboard, enabled: !!user });
}

/** Runs a booking write, caches the returned booking, and refreshes every list and the slots it may have changed. */
export function useBookingWrite() {
  const { user } = useAuth();
  const client = useQueryClient();
  return useCallback(async (write: () => Promise<Booking>) => {
    const booking = await write();
    client.setQueryData(bookingKeys.detail(user?.id, booking.id), booking);
    await Promise.all([
      client.invalidateQueries({ queryKey: bookingKeys.all, predicate: (q) => q.queryKey[1] !== 'detail' || q.queryKey[3] !== booking.id }),
      client.invalidateQueries({ queryKey: [...directoryKeys.all, 'availability'] }),
    ]);
    return booking;
  }, [client, user?.id]);
}
