import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { BroadcastFilters, BroadcastPage, BroadcastPreviewOut, BroadcastSegment, BroadcastSentOut } from './types'

export const broadcastKeys = { all: ['admin', 'broadcasts'] as const }

/** Drop empty filter fields so the preview cache key matches what a send will use. */
const clean = (f: BroadcastFilters) =>
  Object.fromEntries(Object.entries(f).filter(([, v]) => v !== null && v !== undefined && v !== '')) as BroadcastFilters

/** The exact audience a send would reach; the composer re-reads it as the admin edits. */
export function useBroadcastPreview(segment: BroadcastSegment, filters: BroadcastFilters) {
  const body = { segment, filters: clean(filters) }
  return useQuery({
    queryKey: [...broadcastKeys.all, 'preview', body],
    queryFn: () => api<BroadcastPreviewOut>('/admin/broadcasts/preview', { method: 'POST', body }),
    placeholderData: (previous) => previous,
  })
}

/** Past sends, newest first. */
export function useBroadcasts() {
  return useInfiniteQuery({
    queryKey: [...broadcastKeys.all, 'list'],
    queryFn: ({ pageParam }) =>
      api<BroadcastPage>(pageParam ? `/admin/broadcasts?cursor=${encodeURIComponent(pageParam)}` : '/admin/broadcasts'),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.next_cursor,
  })
}

export function useSendBroadcast() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (input: { segment: BroadcastSegment; filters: BroadcastFilters; title: string; body: string; link: string | null }) =>
      api<BroadcastSentOut>('/admin/broadcasts', { method: 'POST', body: { ...input, filters: clean(input.filters) } }),
    onSuccess: () => client.invalidateQueries({ queryKey: broadcastKeys.all }),
  })
}

/** Live cities for the city filter (the backend's public catalog endpoint). */
export function useCities() {
  return useQuery({ queryKey: ['admin', 'cities'], queryFn: () => api<string[]>('/cities'), staleTime: Infinity })
}
