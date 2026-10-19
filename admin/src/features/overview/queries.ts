import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { AdminOverview } from '@/lib/types'
import type { OverviewFilters } from './use-overview-filters'

const UNFILTERED: OverviewFilters = { period: '30d', city: null }

export const overviewKeys = {
  all: ['admin', 'overview'] as const,
  filtered: (f: OverviewFilters) => ['admin', 'overview', f.period, f.city ?? 'all'] as const,
}

/** Overview figures; the sidebar's counts read the unfiltered (last 30 days, all cities) view. */
export function useOverview(filters: OverviewFilters = UNFILTERED) {
  const query = new URLSearchParams({ period: filters.period })
  if (filters.city) query.set('city', filters.city)
  return useQuery({
    queryKey: overviewKeys.filtered(filters),
    queryFn: () => api<AdminOverview>(`/admin/overview?${query.toString()}`),
    refetchInterval: 60_000,
  })
}
