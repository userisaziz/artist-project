import { useState, type FormEvent } from 'react'
import { createSearchParams, useLocation, useNavigate } from 'react-router'
import { Search } from 'lucide-react'
import { OverviewFilters } from '@/features/overview/OverviewFilters'
import { PATHS } from '@/lib/paths'

/**
 * The 64px bar over every console page. Search looks up bookings (code, customer phone or artist name);
 * the city and date-range filters belong to the Overview, so they show there.
 */
export function TopBar() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [query, setQuery] = useState('')

  const search = (e: FormEvent) => {
    e.preventDefault()
    const q = query.trim()
    if (q) navigate({ pathname: PATHS.bookings, search: createSearchParams({ q }).toString() })
  }

  return (
    <header className="flex h-16 shrink-0 items-center gap-3.5 border-b border-line bg-card px-7">
      <form role="search" onSubmit={search} className="flex h-[38px] w-[360px] items-center gap-2 rounded-xl border border-line bg-halo px-3 focus-within:ring-[3px] focus-within:ring-accent">
        <Search aria-hidden className="size-3.5 text-primary" strokeWidth={2.5} />
        <input
          type="search"
          aria-label="Search bookings"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search bookings, customer phones, artists"
          className="h-full flex-1 bg-transparent text-[13px] text-foreground outline-none placeholder:text-faint"
        />
      </form>
      <div className="flex-1" />
      {pathname === PATHS.overview && <OverviewFilters />}
    </header>
  )
}
