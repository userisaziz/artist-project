import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { AdminOverview } from '@/lib/types'

export const overviewKeys = {
  all: ['admin', 'overview'] as const,
}

export function useOverview() {
  return useQuery({ queryKey: overviewKeys.all, queryFn: () => api<AdminOverview>('/admin/overview'), refetchInterval: 60_000 })
}
