import { cn } from '@/lib/utils'

export interface Chip<T> {
  value: T
  label: string
}

/**
 * A row of toggle chips, one pressed at a time: the list pages' status filter.
 * `tone`: the design fills the pressed chip in ink on most lists and in brand pink on the Verification queue.
 */
export function FilterChips<T>({ chips, value, onChange, tone = 'ink' }: { chips: Chip<T>[]; value: T; onChange: (value: T) => void; tone?: 'ink' | 'primary' }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {chips.map((c) => {
        const active = c.value === value
        return (
          <button
            key={c.label}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(c.value)}
            className={cn(
              'flex h-[30px] items-center rounded-full border px-3 text-xs font-semibold transition-colors',
              !active && 'border-input bg-card text-foreground hover:bg-halo',
              active && (tone === 'ink' ? 'border-foreground bg-foreground text-white' : 'border-primary bg-primary text-primary-foreground'),
            )}
          >
            {c.label}
          </button>
        )
      })}
    </div>
  )
}
