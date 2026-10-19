import { Panel } from '@/components/console/panel'
import { Skeleton } from '@/components/ui/skeleton'
import { shortDate } from '@/lib/format'
import type { AdminOverview } from '@/lib/types'
import { cn } from '@/lib/utils'

const CHART_HEIGHT_PX = 172 // tallest bar; the plot area adds the axis labels under it
const MIN_BAR_PX = 4 // an empty week still shows a sliver, so the axis reads as 12 weeks
const RECENT_WEEKS = 3 // the weeks before the current one, in the darker pink

/** ISO week number, as the design labels the axis ("W40"). */
function isoWeek(date: string) {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7))
  const yearStart = Date.UTC(d.getUTCFullYear(), 0, 1)
  return Math.ceil(((d.getTime() - yearStart) / 86_400_000 + 1) / 7)
}

/** Plain CSS bars, oldest week first: the current week in brand pink, the three before it in rose. */
export function WeeklyBookingsChart({ weeks }: { weeks: AdminOverview['bookings_by_week'] | undefined }) {
  const sorted = weeks ? [...weeks].sort((a, b) => a.week_start.localeCompare(b.week_start)) : []
  const max = Math.max(1, ...sorted.map((w) => w.count))
  const total = sorted.reduce((sum, w) => sum + w.count, 0)

  return (
    <Panel className="p-4">
      <div className="flex justify-between">
        <h2 className="text-sm font-bold">Bookings by week</h2>
        {weeks && <span className="text-xs text-muted-foreground">{total.toLocaleString('en-IN')} in {sorted.length} weeks</span>}
      </div>
      {!weeks ? (
        <Skeleton className="mt-3.5 h-[190px] w-full" />
      ) : (
        <ol aria-label="Bookings by week" className="mt-3.5 flex h-[190px] items-end gap-2.5">
          {sorted.map((w, i) => {
            const fromEnd = sorted.length - 1 - i
            const label = `Week of ${shortDate(w.week_start)}: ${w.count} ${w.count === 1 ? 'booking' : 'bookings'}`
            return (
              <li key={w.week_start} aria-label={label} title={label} className="flex flex-1 flex-col items-center gap-1.5">
                <div
                  className={cn('w-full rounded-t-md rounded-b-[2px]', fromEnd === 0 ? 'bg-primary' : fromEnd <= RECENT_WEEKS ? 'bg-rose' : 'bg-accent')}
                  style={{ height: Math.max(MIN_BAR_PX, Math.round((w.count / max) * CHART_HEIGHT_PX)) }}
                />
                <span aria-hidden className="text-[10.5px] whitespace-nowrap text-faint">W{isoWeek(w.week_start)}</span>
              </li>
            )
          })}
        </ol>
      )}
    </Panel>
  )
}
