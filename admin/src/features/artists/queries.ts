import { keepPreviousData, useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { ArtistDetail, ArtistRequirements, ArtistSummary, DirectoryPage, DirectoryStatus, DirectorySummary, Page, ReviewStatus, Suspension } from '@/lib/types'

export const artistKeys = {
  all: ['admin', 'artists'] as const,
  list: (status: ReviewStatus) => ['admin', 'artists', 'list', status] as const,
  detail: (id: string) => ['admin', 'artists', 'detail', id] as const,
  pendingCount: ['admin', 'artists', 'pending-count'] as const,
  directory: (f: DirectoryFilter) => ['admin', 'artists', 'directory', f.status, f.q] as const,
  directorySummary: ['admin', 'artists', 'directory-summary'] as const,
  requirements: (id: string) => ['admin', 'artists', 'requirements', id] as const,
}

const DIRECTORY_PAGE_SIZE = 20

/** `q` matches the business name. */
export interface DirectoryFilter {
  status: DirectoryStatus
  q: string
}

/** Every listed artist, newest first, a page at a time; the previous rows stay up while a new filter loads. */
export function useArtistDirectory(filter: DirectoryFilter) {
  return useInfiniteQuery({
    queryKey: artistKeys.directory(filter),
    queryFn: ({ pageParam }) => {
      const params = new URLSearchParams({ status: filter.status, limit: String(DIRECTORY_PAGE_SIZE) })
      if (filter.q) params.set('q', filter.q)
      if (pageParam) params.set('cursor', pageParam)
      return api<DirectoryPage>(`/admin/artists/directory?${params.toString()}`)
    },
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.next_cursor,
    placeholderData: keepPreviousData,
  })
}

/** Chip counts and the KPI strip over the directory. */
export function useDirectorySummary() {
  return useQuery({ queryKey: artistKeys.directorySummary, queryFn: () => api<DirectorySummary>('/admin/artists/directory/summary') })
}

/**
 * Suspend (approved only, reason required) or reinstate (suspended only). A suspended artist is hidden
 * everywhere approval is required and can't take new bookings; existing bookings are left as they are.
 */
export function useSuspension(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (change: { action: 'suspend'; reason: string } | { action: 'reinstate' }) =>
      change.action === 'suspend'
        ? api<Suspension>(`/admin/artists/${id}/suspend`, { method: 'POST', body: { reason: change.reason } })
        : api<Suspension>(`/admin/artists/${id}/reinstate`, { method: 'POST' }),
    onSuccess: (result) => {
      queryClient.setQueryData<ArtistDetail>(artistKeys.detail(id), (prev) => (prev ? { ...prev, status: result.status } : prev))
      return queryClient.invalidateQueries({ queryKey: artistKeys.all })
    },
  })
}

export function useArtistQueue(status: ReviewStatus) {
  return useInfiniteQuery({
    queryKey: artistKeys.list(status),
    queryFn: ({ pageParam }) =>
      api<Page<ArtistSummary>>(`/admin/artists?status=${status}&limit=20${pageParam ? `&cursor=${encodeURIComponent(pageParam)}` : ''}`),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.next_cursor,
  })
}

/** Sidebar badge: pending submissions, shown as "99+" past one page of 100. */
export function usePendingCount() {
  return useQuery({
    queryKey: artistKeys.pendingCount,
    queryFn: async () => {
      const page = await api<Page<ArtistSummary>>('/admin/artists?status=pending&limit=100')
      return page.next_cursor ? '99+' : page.items.length || null
    },
    refetchInterval: 60_000,
  })
}

export function useArtist(id: string) {
  return useQuery({ queryKey: artistKeys.detail(id), queryFn: () => api<ArtistDetail>(`/admin/artists/${id}`) })
}

export function useReviewArtist(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (decision: { action: 'approve' } | { action: 'reject'; reason: string }) =>
      decision.action === 'approve'
        ? api<ArtistDetail>(`/admin/artists/${id}/approve`, { method: 'POST' })
        : api<ArtistDetail>(`/admin/artists/${id}/reject`, { method: 'POST', body: { reason: decision.reason } }),
    onSuccess: (artist) => {
      queryClient.setQueryData(artistKeys.detail(id), artist)
      return queryClient.invalidateQueries({ queryKey: artistKeys.all })
    },
  })
}

/** Logged by the server. Not a query or a mutation on purpose: the full number lives only in the caller's component state. */
export function revealAadhaar(id: string) {
  return api<{ aadhaar_number: string }>(`/admin/artists/${id}/kyc/reveal`, { method: 'POST' })
}

/** Mandatory profile items this artist hasn't added yet, and whether that has put them on hold. */
export function useArtistRequirements(id: string) {
  return useQuery({ queryKey: artistKeys.requirements(id), queryFn: () => api<ArtistRequirements>(`/admin/requirements/${id}`) })
}

/** Sends the artist an in-app reminder (and push) to complete their profile. */
export function useRemindArtist(id: string) {
  return useMutation({ mutationFn: () => api<void>(`/admin/requirements/${id}/remind`, { method: 'POST' }) })
}
