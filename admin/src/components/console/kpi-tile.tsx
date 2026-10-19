import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

export type KpiTone = 'up' | 'warn' | 'alert' | 'muted'

interface KpiTileProps {
  label: string
  value: string | undefined
  note?: string
  tone?: KpiTone
  /** Overview cards are larger than the KPI strip above a table. */
  size?: 'lg' | 'md'
  /** The pink card the design uses for the figure that needs attention. */
  highlighted?: boolean
  title?: string
}

const NOTE_TONE: Record<KpiTone, string> = {
  up: 'text-success',
  warn: 'text-warning',
  alert: 'text-primary',
  muted: 'text-muted-foreground',
}

/** One headline figure: label, big number, a coloured note under it. */
export function KpiTile({ label, value, note, tone = 'muted', size = 'md', highlighted = false, title }: KpiTileProps) {
  return (
    <div role="group" aria-label={label} className={cn('rounded-2xl border', size === 'lg' ? 'p-4' : 'px-4 py-3.5', highlighted ? 'border-rose bg-accent' : 'border-line bg-card')}>
      <div className={cn('text-xs', highlighted ? 'text-subtle-foreground' : 'text-muted-foreground')}>{label}</div>
      {value === undefined ? (
        <Skeleton className="mt-2 h-7 w-24" />
      ) : (
        <div
          title={title}
          className={cn(
            'font-semibold tracking-[-0.025em] tabular-nums',
            size === 'lg' ? 'mt-1 text-[26.5px]' : 'mt-0.5 text-[23.4px]',
            highlighted && 'text-primary',
          )}
        >
          {value}
        </div>
      )}
      {note && <div className={cn('font-semibold', size === 'lg' ? 'text-xs' : 'text-[11.5px]', NOTE_TONE[tone])}>{note}</div>}
    </div>
  )
}
