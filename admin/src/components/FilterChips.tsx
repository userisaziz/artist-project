import { cn } from '@/lib/utils'

export interface Chip<T> {
  value: T
  label: string
}

/** A row of toggle chips, one pressed at a time: the list pages' status filter. */
export function FilterChips<T>({ chips, value, onChange }: { chips: Chip<T>[]; value: T; onChange: (value: T) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {chips.map((c) => {
        const active = c.value === value
        return (
          <button
            key={c.label}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(c.value)}
            className={cn(
              'rounded-full border px-3 py-1 text-sm font-medium transition-colors',
              active ? 'border-primary bg-primary text-primary-foreground' : 'bg-card hover:bg-muted',
            )}
          >
            {c.label}
          </button>
        )
      })}
    </div>
  )
}
