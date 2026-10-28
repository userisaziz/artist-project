import { useCallback } from 'react';
import { keepPreviousData, useInfiniteQuery, useQuery, useQueryClient, type InfiniteData } from '@tanstack/react-query';
import * as directoryApi from '../../api/directory/directory';
import { istDateKey } from '../../utils/common/time';
import type { DirectoryFilter } from '../../api/directory/directory';
import type { ArtistCard, ArtistCardPage, CustomerPlace } from '../../types/directory/directory';

const PAGE_SIZE = 20;

export const directoryKeys = {
  all: ['directory'] as const,
  list: (categoryId: number | null, q: string, place: CustomerPlace | null) =>
    ['directory', 'list', categoryId, q, place?.city ?? null, place?.coords?.latitude ?? null, place?.coords?.longitude ?? null] as const,
  search: (filter: ExploreSearch) => ['directory', 'search', filter] as const,
  artist: (id: string) => ['directory', 'artist', id] as const,
  availability: (artistId: string, date: string, serviceId: string) => ['directory', 'availability', artistId, date, serviceId] as const,
};

/** GET /artists, page by page (Home's carousels). With a point (the phone's position or a searched area) the server
 *  keeps to a radius around it, nearest first, and the city is left out; otherwise the place's city filters. A new place
 *  keeps the old artists on screen until its own answer arrives. */
export function useArtistList(categoryId: number | null = null, q = '', place: CustomerPlace | null = null) {
  const point = place?.coords ?? null;
  return useInfiniteQuery({
    queryKey: directoryKeys.list(categoryId, q, place),
    queryFn: ({ pageParam }) => directoryApi.listArtists({
      category_id: categoryId,
      q: q || undefined,
      city: point ? undefined : place?.city ?? undefined,
      near_lat: point?.latitude ?? null,
      near_lng: point?.longitude ?? null,
      sort: point ? 'nearest' : undefined,
      limit: PAGE_SIZE,
      cursor: pageParam,
    }),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.next_cursor,
    placeholderData: keepPreviousData,
  });
}

/** Explore's search: every GET /artists filter except paging. */
export type ExploreSearch = Omit<DirectoryFilter, 'limit' | 'cursor'>;

/** GET /artists with Explore's filters and sort, page by page; `total` rides on every page. Each keystroke or chip
 *  keeps the current artists on screen (`isPlaceholderData`) until the new answer arrives. */
export function useArtistSearch(search: ExploreSearch) {
  return useInfiniteQuery({
    queryKey: directoryKeys.search(search),
    queryFn: ({ pageParam }) => directoryApi.listArtists({ ...search, limit: PAGE_SIZE, cursor: pageParam }),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.next_cursor,
    placeholderData: keepPreviousData,
  });
}

export function useArtistPublic(id: string) {
  return useQuery({ queryKey: directoryKeys.artist(id), queryFn: () => directoryApi.getArtist(id), enabled: !!id });
}

/** The artist's card from any list already on the device (Home, Explore), so their page can show the hero at once. */
export function useCachedArtistCard(id: string): ArtistCard | undefined {
  const client = useQueryClient();
  const lists = client.getQueriesData<InfiniteData<ArtistCardPage>>({
    predicate: (query) => query.queryKey[0] === 'directory' && (query.queryKey[1] === 'list' || query.queryKey[1] === 'search'),
  });
  for (const [, data] of lists) {
    const card = data?.pages.flatMap((p) => p.items).find((a) => a.id === id);
    if (card) return card;
  }
  return undefined;
}

/** Starts loading an artist's page as the tile is tapped, so it's often ready by the time the screen slides in. */
export function usePrefetchArtist() {
  const client = useQueryClient();
  return useCallback(
    (id: string) => { void client.prefetchQuery({ queryKey: directoryKeys.artist(id), queryFn: () => directoryApi.getArtist(id) }); },
    [client],
  );
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
