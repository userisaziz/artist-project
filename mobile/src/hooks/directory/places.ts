import { keepPreviousData, useQuery } from '@tanstack/react-query';
import * as placesApi from '../../api/directory/places';
import type { Coordinates } from '../../core/location/location';

export const PLACE_SEARCH_MIN_CHARS = 3;
const PLACE_SEARCH_STALE_MS = 5 * 60_000;

/** "Search your area": idle under three characters; the previous matches stay while the next ones load. */
export function usePlaceSearch(q: string, near: Coordinates | null) {
  return useQuery({
    queryKey: ['directory', 'places', q.toLowerCase(), near?.latitude, near?.longitude],
    queryFn: () => placesApi.searchPlaces(q, near),
    enabled: q.length >= PLACE_SEARCH_MIN_CHARS,
    placeholderData: keepPreviousData,
    staleTime: PLACE_SEARCH_STALE_MS,
  });
}
