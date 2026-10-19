import { keepPreviousData, useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { AdminPost, AdminPostPage, Decision, FeedSummary, FeedView } from './types'

const PAGE_SIZE = 20

export const feedAdminKeys = {
  all: ['admin', 'feed'] as const,
  list: (view: FeedView) => ['admin', 'feed', 'list', view] as const,
  summary: ['admin', 'feed', 'summary'] as const,
}

export function useAdminPosts(view: FeedView) {
  return useInfiniteQuery({
    queryKey: feedAdminKeys.list(view),
    queryFn: ({ pageParam }) => {
      const params = new URLSearchParams({ view, limit: String(PAGE_SIZE) })
      if (pageParam) params.set('cursor', pageParam)
      return api<AdminPostPage>(`/admin/feed/posts?${params.toString()}`)
    },
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.next_cursor,
    placeholderData: keepPreviousData,
  })
}

export function useFeedSummary() {
  return useQuery({ queryKey: feedAdminKeys.summary, queryFn: () => api<FeedSummary>('/admin/feed/summary') })
}

type PostAction = { kind: 'moderate'; decision: Decision } | { kind: 'feature'; on: boolean }

export function usePostAction() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, action }: { id: string; action: PostAction }) =>
      action.kind === 'moderate'
        ? api<AdminPost>(`/admin/feed/posts/${id}/moderate`, { method: 'POST', body: { decision: action.decision } })
        : api<AdminPost>(`/admin/feed/posts/${id}/feature`, { method: action.on ? 'POST' : 'DELETE' }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: feedAdminKeys.all }),
  })
}
