import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as catalogApi from '../../api/catalog/catalog';
import { CATEGORIES_KEY, CITIES_KEY, areasKey } from '../../core/api/query-keys';
import type { Coordinates } from '../../core/location/location';

// The catalog barely moves: the category tree is read by nearly every screen, and the cities and the
// areas only change when an admin edits them.
const CATEGORIES_STALE_MS = 5 * 60_000;

export function useCategories() {
  return useQuery({ queryKey: CATEGORIES_KEY, queryFn: catalogApi.listCategories, staleTime: CATEGORIES_STALE_MS });
}

export function useCities() {
  return useQuery({ queryKey: CITIES_KEY, queryFn: catalogApi.listCities, staleTime: Infinity });
}

/** The areas an artist picks their studio's from; idle until the city is known. */
export function useAreas(city: string | null) {
  return useQuery({
    queryKey: areasKey(city),
    queryFn: () => catalogApi.listAreas(city ?? ''),
    enabled: !!city,
    staleTime: Infinity,
  });
}

/** The area a confirmed map pin falls in (null outside every area); idle without a pin. */
export function useNearestArea(pin: Coordinates | null) {
  return useQuery({
    queryKey: ['catalog', 'areas', 'nearest', pin?.latitude, pin?.longitude],
    queryFn: () => catalogApi.nearestArea(pin?.latitude ?? 0, pin?.longitude ?? 0),
    enabled: !!pin,
    staleTime: Infinity,
  });
}

/**
 * Warms the catalog while the app starts.
 *
 * The category tree is on nearly every screen and the cities on the artist's profile step, so both
 * are fetched as soon as the app is up rather than when a screen mounts. The requests run in the
 * background: a screen that asks in the meantime joins the one already in flight instead of
 * starting its own, and a failed warm-up is simply a screen that loads as it always did.
 */
export function usePrefetchCatalog() {
  const client = useQueryClient();
  useEffect(() => {
    void client.prefetchQuery({ queryKey: CATEGORIES_KEY, queryFn: catalogApi.listCategories, staleTime: CATEGORIES_STALE_MS });
    void client.prefetchQuery({ queryKey: CITIES_KEY, queryFn: catalogApi.listCities, staleTime: Infinity });
  }, [client]);
}

/**
 * The areas of one city, fetched before the screen that lists them asks.
 *
 * The area list is the last step of the artist's location form, and it can only be asked for once
 * the city is known — so the city the artist already works in is prefetched as soon as the profile
 * arrives, and the form opens on a list that is already there.
 */
export function usePrefetchAreas(city: string | null) {
  const client = useQueryClient();
  useEffect(() => {
    if (!city) return;
    void client.prefetchQuery({ queryKey: areasKey(city), queryFn: () => catalogApi.listAreas(city), staleTime: Infinity });
  }, [client, city]);
}
