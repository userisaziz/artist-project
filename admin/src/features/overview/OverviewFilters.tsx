import { FilterSelect } from '@/components/ui/filter-select'
import { useOverview } from './queries'
import { ALL_CITIES, PERIOD_OPTIONS, useOverviewFilters } from './use-overview-filters'

/** The top bar's "All cities" and "Last 30 days" dropdowns; the city list is every city with an approved artist. */
export function OverviewFilters() {
  const { filters, setCity, setPeriod } = useOverviewFilters()
  const cities = useOverview().data?.cities ?? []
  const cityOptions = [{ value: ALL_CITIES, label: 'All cities' }, ...cities.map((c) => ({ value: c, label: c }))]

  return (
    <>
      <FilterSelect label="City" value={filters.city ?? ALL_CITIES} options={cityOptions} onValueChange={setCity} />
      <FilterSelect label="Date range" value={filters.period} options={PERIOD_OPTIONS} onValueChange={setPeriod} />
    </>
  )
}
