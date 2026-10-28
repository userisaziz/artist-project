import { useState } from 'react';
import { useDetectLocation } from './use-detect-location';
import type { CustomerPlace, DirectorySort } from '../../types/directory/directory';
import type { ExploreSearch } from './directory';

export const TOP_RATED = 4.8;

/** Explore's filter chips and sort; the search point comes from the shared place. */
export interface ExploreFilters {
  sort: DirectorySort;
  minRating: number | null;
  maxPricePaise: number | null;
  homeVisit: boolean;
  availableOn: string | null;
}

const NONE: Omit<ExploreFilters, 'sort'> = { minRating: null, maxPricePaise: null, homeVisit: false, availableOn: null };
const DEFAULT_SORT: DirectorySort = 'recommended';

/** `search` is what goes to GET /artists. With a point (the phone's position or a searched area) the server keeps to a
 *  radius around it and the city is left out; without one, the place's city (if any) filters. */
export function useExploreFilters(base: { place: CustomerPlace | null; categoryId: number | null; q: string }) {
  const [filters, setFilters] = useState<ExploreFilters>({ ...NONE, sort: DEFAULT_SORT });
  const phone = useDetectLocation({ auto: false });
  const set = (change: Partial<ExploreFilters>) => setFilters((f) => ({ ...f, ...change }));
  const point = base.place?.coords ?? null;
  // "Nearest" needs a point: if the place loses it (cleared, or a whole city picked), fall back to the default.
  const sort = filters.sort === 'nearest' && !point ? DEFAULT_SORT : filters.sort;
  const nearMe = sort === 'nearest';

  /** "Near me": off again if on; otherwise sorts by distance, finding the phone first when there's no point yet. */
  const toggleNear = async () => {
    if (nearMe) {
      set({ sort: DEFAULT_SORT });
      return;
    }
    if (!point && !(await phone.locate())) return;
    set({ sort: 'nearest' });
  };

  const search: ExploreSearch = {
    city: point ? undefined : base.place?.city ?? undefined,
    category_id: base.categoryId,
    q: base.q || undefined,
    sort,
    min_rating: filters.minRating,
    max_price_paise: filters.maxPricePaise,
    home_visit: filters.homeVisit,
    available_on: filters.availableOn,
    near_lat: point?.latitude ?? null,
    near_lng: point?.longitude ?? null,
  };
  const active = filters.minRating !== null || filters.maxPricePaise !== null || filters.homeVisit || !!filters.availableOn || nearMe;

  return {
    filters: { ...filters, sort },
    search,
    active,
    nearMe,
    hasPoint: !!point,
    locating: phone.locating,
    locationError: phone.error,
    phone,
    set,
    toggleNear,
    clear: () => setFilters({ ...NONE, sort: DEFAULT_SORT }),
  };
}
