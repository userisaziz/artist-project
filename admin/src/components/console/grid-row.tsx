import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { cn } from '@/lib/utils'

interface GridRowProps {
  columns: string
  /** Opens the row's detail page. */
  to?: string
  onClick?: () => void
  selected?: boolean
  children: ReactNode
}

/**
 * One table row on the shared grid template; the whole row is the link to its detail.
 * On phones the row becomes a card: the first cell takes the full width and the rest wrap beneath it.
 * Cells mark themselves `max-md:hidden` to drop off the card, and use CellLabel to name a bare number.
 */
export function GridRow({ columns, to, onClick, selected = false, children }: GridRowProps) {
  const className = cn(
    'flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-line-soft px-4 py-3 text-[13px] *:first:basis-full md:grid md:gap-3 md:py-[11px] text-foreground transition-colors hover:bg-row-hover',
    (to || onClick) && 'cursor-pointer',
    selected && 'bg-halo hover:bg-halo',
  )
  const style = { gridTemplateColumns: columns }
  if (to) return <Link to={to} className={className} style={style}>{children}</Link>
  if (onClick) return <button type="button" onClick={onClick} aria-pressed={selected} className={cn(className, 'w-full text-left')} style={style}>{children}</button>
  return <div className={className} style={style}>{children}</div>
}
