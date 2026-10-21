import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import * as directoryApi from '../../api/directory/directory';
import { istDateKey } from '../../utils/common/time';

const PAGE_SIZE = 20;

export const directoryKeys = {
  all: ['directory'] as const,
  list: (categoryId: number | null, q: string) => ['directory', 'list', categoryId, q] as const,
  artist: (id: string) => ['directory', 'artist', id] as const,
  availability: (artistId: string, date: string, serviceId: string) => ['directory', 'availability', artistId, date, serviceId] as const,
};

/** GET /artists, page by page (Explore's infinite list, Home's carousels). */
export function useArtistList(categoryId: number | null = null, q = '') {
  return useInfiniteQuery({
    queryKey: directoryKeys.list(categoryId, q),
    queryFn: ({ pageParam }) => directoryApi.listArtists({ category_id: categoryId, q: q || undefined, limit: PAGE_SIZE, cursor: pageParam }),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.next_cursor,
  });
}

export function useArtistPublic(id: string) {
  return useQuery({ queryKey: directoryKeys.artist(id), queryFn: () => directoryApi.getArtist(id), enabled: !!id });
}

export function useAvailability(artistId: string, date: string, serviceId: string) {
  return useQuery({
    queryKey: directoryKeys.availability(artistId, date, serviceId),
    queryFn: () => directoryApi.getAvailability(artistId, date, serviceId),
    enabled: !!artistId && !!serviceId && !!date,
    staleTime: 0, // slots go fast: always refetch when the date is shown again
  });
}

/** The picked start only while that day's slots still offer it (a refetch after a conflict can take it away). */
export function useStillAvailable(artistId: string, serviceId: string, startAt: string | null): string | null {
  const slots = useAvailability(artistId, startAt ? istDateKey(startAt) : '', serviceId);
  return startAt && slots.data?.slots.some((s) => s.start_at === startAt && s.available) ? startAt : null;
}
