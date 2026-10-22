import { useQuery } from '@tanstack/react-query';
import * as catalogApi from '../../api/catalog/catalog';
import type { Coordinates } from '../../core/location/location';

export function useCategories() {
  return useQuery({ queryKey: ['catalog', 'categories'], queryFn: catalogApi.listCategories, staleTime: 5 * 60_000 });
}

export function useCities() {
  return useQuery({ queryKey: ['catalog', 'cities'], queryFn: catalogApi.listCities, staleTime: Infinity });
}

/** The areas an artist picks their studio's from; idle until the city is known. */
export function useAreas(city: string | null) {
  return useQuery({
    queryKey: ['catalog', 'areas', city],
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
