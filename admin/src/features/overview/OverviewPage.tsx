import { useState } from 'react'
import { Accent } from '@/components/accent'
import { KpiTile } from '@/components/console/kpi-tile'
import { useAuth } from '@/lib/auth-context'
import { rupees, rupeesShort } from '@/lib/format'
import { trend } from '@/lib/trend'
import type { AdminOverview } from '@/lib/types'
import { useOverview } from './queries'
import { useOverviewFilters } from './use-overview-filters'
import { VerificationQueuePanel } from './VerificationQueuePanel'
import { WeeklyBookingsChart } from './WeeklyBookingsChart'

const count = new Intl.NumberFormat('en-IN')

function greeting(hour: number) {
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

/** The console's landing page: the chosen period at a glance and who is waiting for review. */
export function OverviewPage() {
  const { user } = useAuth()
  const { filters } = useOverviewFilters()
  const overview = useOverview(filters)
  const o = overview.data
  const [hour] = useState(() => new Date().getHours()) // fixed for the visit, so re-renders don't flip the greeting

  return (
    <div className="flex flex-col">
      <h1 className="text-[26.5px] leading-none font-semibold tracking-[-0.025em]">
        {greeting(hour)}, <Accent>{user?.first_name ?? 'there'}</Accent>
      </h1>
      {o && (
        <p className="mt-1.5 text-[13px] text-muted-foreground">
          {count.format(o.pending_artists)} {o.pending_artists === 1 ? 'artist is' : 'artists are'} waiting for verification and {count.format(o.awaiting_artist)} {o.awaiting_artist === 1 ? 'request is' : 'requests are'} waiting for an artist.
        </p>
      )}
      {overview.isError && <p role="alert" className="mt-3 text-[13px] text-destructive">Couldn’t load the overview. {overview.error.message}</p>}

      <Kpis overview={o} />

      <div className="mt-3.5 grid gap-3.5 lg:grid-cols-[1.4fr_1fr]">
        <WeeklyBookingsChart weeks={o?.bookings_by_week} />
        <VerificationQueuePanel />
      </div>
    </div>
  )
}

function Kpis({ overview: o }: { overview: AdminOverview | undefined }) {
  const gross = o ? trend(o.gross_paise, o.gross_paise_previous) : { tone: 'muted' as const }
  const bookings = o ? trend(o.bookings, o.bookings_previous) : { tone: 'muted' as const }
  return (
    <div className="mt-5 grid grid-cols-2 gap-3.5 lg:grid-cols-4">
      <KpiTile size="lg" label="Gross bookings" value={o && rupeesShort(o.gross_paise)} title={o && rupees(o.gross_paise)} note={gross.note} tone={gross.tone} />
      <KpiTile size="lg" label="Bookings" value={o && count.format(o.bookings)} note={bookings.note} tone={bookings.tone} />
      <KpiTile size="lg" label="New artists" value={o && count.format(o.new_artists)} note={o && `${count.format(o.pending_artists)} pending review`} tone="warn" />
      <KpiTile size="lg" highlighted label="Awaiting artist" value={o && count.format(o.awaiting_artist)} note="Requests not yet answered" tone="alert" />
    </div>
  )
}
