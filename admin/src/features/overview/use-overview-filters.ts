import { useSearchParams } from 'react-router'
import type { OverviewPeriod } from '@/lib/types'

export const PERIOD_OPTIONS: { value: OverviewPeriod; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: 'quarter', label: 'This quarter' },
]

export const ALL_CITIES = 'all'
const DEFAULT_PERIOD: OverviewPeriod = '30d'

export interface OverviewFilters {
  period: OverviewPeriod
  city: string | null // null: all cities
}

/** The Overview's city and date range live in the URL (?period=&city=), so a filtered view survives reload and can be shared. */
export function useOverviewFilters() {
  const [params, setParams] = useSearchParams()
  const period = PERIOD_OPTIONS.find((p) => p.value === params.get('period'))?.value ?? DEFAULT_PERIOD
  const city = params.get('city') || null

  const update = (key: 'period' | 'city', value: string | null) =>
    setParams((prev) => {
      const next = new URLSearchParams(prev)
      if (value) next.set(key, value)
      else next.delete(key)
      return next
    }, { replace: true })

  return {
    filters: { period, city } satisfies OverviewFilters,
    setPeriod: (value: OverviewPeriod) => update('period', value === DEFAULT_PERIOD ? null : value),
    setCity: (value: string) => update('city', value === ALL_CITIES ? null : value),
  }
}
