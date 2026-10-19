import { keepPreviousData, useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { QueueView, SupportSummary, Ticket, TicketPage, TicketPriority, Topic } from './types'

const PAGE_SIZE = 20
const QUEUE_REFRESH_MS = 30_000

export const supportKeys = {
  all: ['admin', 'support'] as const,
  queue: (view: QueueView) => ['admin', 'support', 'queue', view] as const,
  summary: ['admin', 'support', 'summary'] as const,
  ticket: (id: string) => ['admin', 'support', 'ticket', id] as const,
}

/** Newest first; refreshes every 30s so new tickets show up while the page is open. */
export function useQueue(view: QueueView) {
  return useInfiniteQuery({
    queryKey: supportKeys.queue(view),
    queryFn: ({ pageParam }) => {
      const params = new URLSearchParams({ view, limit: String(PAGE_SIZE) })
      if (pageParam) params.set('cursor', pageParam)
      return api<TicketPage>(`/admin/support/tickets?${params.toString()}`)
    },
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.next_cursor,
    placeholderData: keepPreviousData,
    refetchInterval: QUEUE_REFRESH_MS,
  })
}

export function useSupportSummary() {
  return useQuery({
    queryKey: supportKeys.summary,
    queryFn: () => api<SupportSummary>('/admin/support/summary'),
    refetchInterval: QUEUE_REFRESH_MS,
  })
}

export function useTicket(id: string | null) {
  return useQuery({
    queryKey: supportKeys.ticket(id ?? ''),
    queryFn: () => api<Ticket>(`/admin/support/tickets/${id}`),
    enabled: !!id,
  })
}

type TicketAction =
  | { kind: 'reply'; text: string }
  | { kind: 'assign' }
  | { kind: 'close' }
  | { kind: 'priority'; priority: TicketPriority }

function send(id: string, action: TicketAction) {
  const base = `/admin/support/tickets/${id}`
  switch (action.kind) {
    case 'reply':
      return api<Ticket>(`${base}/reply`, { method: 'POST', body: { text: action.text } })
    case 'assign':
      return api<Ticket>(`${base}/assign`, { method: 'POST' })
    case 'close':
      return api<Ticket>(`${base}/close`, { method: 'POST' })
    case 'priority':
      return api<Ticket>(base, { method: 'PATCH', body: { priority: action.priority } })
  }
}

/** Every ticket action returns the ticket: it's cached, and the queue and counts refresh. */
export function useTicketAction(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (action: TicketAction) => send(id, action),
    onSuccess: (ticket) => queryClient.setQueryData(supportKeys.ticket(id), ticket),
    onSettled: () => queryClient.invalidateQueries({ queryKey: supportKeys.all, predicate: (q) => q.queryKey[2] !== 'ticket' }),
  })
}

export interface NewTicketInput {
  phone: string
  topic: Topic
  issue: string
  message: string
}

export function useCreateTicket() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: NewTicketInput) => api<Ticket>('/admin/support/tickets', { method: 'POST', body: input }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: supportKeys.all }),
  })
}
