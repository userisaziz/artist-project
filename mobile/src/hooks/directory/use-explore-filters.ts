import { useLocalSearchParams, useRouter } from 'expo-router';
import { z } from 'zod';
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

const DEFAULT_SORT: DirectorySort = 'recommended';
const SORTS = ['recommended', 'nearest', 'rating', 'price', 'recent'] as const satisfies readonly DirectorySort[];
const MAX_RATING = 5;

/** The filters live in the URL (`/customer/explore?sort=price&minRating=4.8&maxPrice=500000&home=1&date=2026-11-25`),
 *  so a shared link or a reload lands on the same results. Anything malformed falls back to "no filter". */
const paramsSchema = z.object({
  sort: z.enum(SORTS).catch(DEFAULT_SORT),
  minRating: z.string().regex(/^\d+(\.\d+)?$/).transform(Number).pipe(z.number().positive().max(MAX_RATING)).nullable().catch(null),
  maxPrice: z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().positive()).nullable().catch(null),
  home: z.literal('1').nullable().catch(null),
  date: z.iso.date().nullable().catch(null),
});

type RawParams = Record<string, string | string[] | undefined>;
type UrlParams = Record<keyof z.input<typeof paramsSchema>, string | undefined>;

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** Read the filters from the route's search params; each one is validated on its own. */
export function parseExploreParams(raw: RawParams): ExploreFilters {
  const p = paramsSchema.parse({
    sort: first(raw.sort), minRating: first(raw.minRating) ?? null, maxPrice: first(raw.maxPrice) ?? null,
    home: first(raw.home) ?? null, date: first(raw.date) ?? null,
  });
  return { sort: p.sort, minRating: p.minRating, maxPricePaise: p.maxPrice, homeVisit: p.home === '1', availableOn: p.date };
}

/** The params a filter change writes; an off filter is `undefined`, which drops it from the URL. */
export function exploreParams(change: Partial<ExploreFilters>): Partial<UrlParams> {
  const out: Partial<UrlParams> = {};
  if ('sort' in change) out.sort = change.sort && change.sort !== DEFAULT_SORT ? change.sort : undefined;
  if ('minRating' in change) out.minRating = change.minRating == null ? undefined : String(change.minRating);
  if ('maxPricePaise' in change) out.maxPrice = change.maxPricePaise == null ? undefined : String(change.maxPricePaise);
  if ('homeVisit' in change) out.home = change.homeVisit ? '1' : undefined;
  if ('availableOn' in change) out.date = change.availableOn ?? undefined;
  return out;
}

const CLEARED: Partial<ExploreFilters> = { sort: DEFAULT_SORT, minRating: null, maxPricePaise: null, homeVisit: false, availableOn: null };

/** `search` is what goes to GET /artists. With a point (the phone's position or a searched area) the server keeps to a
 *  radius around it and the city is left out; without one, the place's city (if any) filters. */
export function useExploreFilters(base: { place: CustomerPlace | null; categoryId: number | null; q: string }) {
  const router = useRouter();
  const filters = parseExploreParams(useLocalSearchParams());
  const phone = useDetectLocation({ auto: false });
  const set = (change: Partial<ExploreFilters>) => router.setParams(exploreParams(change));
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
    clear: () => set(CLEARED),
  };
}
