import { shortDate } from '@/lib/format'
import type { AdminOverview } from '@/lib/types'
import { cn } from '@/lib/utils'

const CHART_HEIGHT_PX = 180
const MIN_BAR_PX = 4 // an empty week still shows a sliver, so the axis reads as 12 weeks

/** Plain CSS bars, oldest week first; the current (last) week is in the brand colour. */
export function WeeklyBookingsChart({ weeks }: { weeks: AdminOverview['bookings_by_week'] }) {
  const sorted = [...weeks].sort((a, b) => a.week_start.localeCompare(b.week_start))
  const max = Math.max(1, ...sorted.map((w) => w.count))

  return (
    <ol aria-label="Bookings by week" className="flex items-end gap-2" style={{ height: CHART_HEIGHT_PX + 24 }}>
      {sorted.map((w, i) => {
        const current = i === sorted.length - 1
        const label = `Week of ${shortDate(w.week_start)}: ${w.count} ${w.count === 1 ? 'booking' : 'bookings'}`
        return (
          <li key={w.week_start} aria-label={label} title={label} className="flex flex-1 flex-col items-center gap-1.5">
            <div
              className={cn('w-full rounded-t-md rounded-b-sm', current ? 'bg-primary' : 'bg-primary/20')}
              style={{ height: Math.max(MIN_BAR_PX, Math.round((w.count / max) * CHART_HEIGHT_PX)) }}
            />
            <span aria-hidden className="text-[10.5px] whitespace-nowrap text-muted-foreground">{shortDate(w.week_start)}</span>
          </li>
        )
      })}
    </ol>
  )
}
