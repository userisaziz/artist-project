import { useState } from 'react';
import { currentPosition, locationErrorMessage } from '../../core/location/location';
import type { Coordinates } from '../../core/location/location';
import type { DirectorySort } from '../../types/directory/directory';
import type { ExploreSearch } from './directory';

export const TOP_RATED = 4.8;

/** Explore's filter chips, sort and "Near me" point; `search` is what goes to GET /artists. */
export interface ExploreFilters {
  sort: DirectorySort;
  minRating: number | null;
  maxPricePaise: number | null;
  homeVisit: boolean;
  availableOn: string | null;
  near: Coordinates | null;
}

const NONE: Omit<ExploreFilters, 'sort'> = { minRating: null, maxPricePaise: null, homeVisit: false, availableOn: null, near: null };
const DEFAULT_SORT: DirectorySort = 'recommended';

export function useExploreFilters(base: { city: string | null; categoryId: number | null; q: string }) {
  const [filters, setFilters] = useState<ExploreFilters>({ ...NONE, sort: DEFAULT_SORT });
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const set = (change: Partial<ExploreFilters>) => setFilters((f) => ({ ...f, ...change }));

  /** "Near me": off again if on; otherwise asks the phone where it is and sorts by distance. */
  const toggleNear = async () => {
    setLocationError(null);
    if (filters.near) {
      set({ near: null, sort: filters.sort === 'nearest' ? DEFAULT_SORT : filters.sort });
      return;
    }
    setLocating(true);
    try {
      set({ near: await currentPosition(), sort: 'nearest' });
    } catch (e) {
      setLocationError(locationErrorMessage(e));
    } finally {
      setLocating(false);
    }
  };

  const search: ExploreSearch = {
    city: base.city ?? undefined,
    category_id: base.categoryId,
    q: base.q || undefined,
    sort: filters.sort,
    min_rating: filters.minRating,
    max_price_paise: filters.maxPricePaise,
    home_visit: filters.homeVisit,
    available_on: filters.availableOn,
    near_lat: filters.near?.latitude ?? null,
    near_lng: filters.near?.longitude ?? null,
  };
  const active = filters.minRating !== null || filters.maxPricePaise !== null || filters.homeVisit || !!filters.availableOn || !!filters.near;

  return {
    filters,
    search,
    active,
    locating,
    locationError,
    set,
    toggleNear,
    clear: () => { setLocationError(null); setFilters({ ...NONE, sort: DEFAULT_SORT }); },
  };
}
