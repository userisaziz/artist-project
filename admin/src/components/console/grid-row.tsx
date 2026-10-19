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

/** One table row on the shared grid template; the whole row is the link to its detail. */
export function GridRow({ columns, to, onClick, selected = false, children }: GridRowProps) {
  const className = cn(
    'grid items-center gap-3 border-b border-line-soft px-4 py-[11px] text-[13px] text-foreground transition-colors hover:bg-row-hover',
    (to || onClick) && 'cursor-pointer',
    selected && 'bg-halo hover:bg-halo',
  )
  const style = { gridTemplateColumns: columns }
  if (to) return <Link to={to} className={className} style={style}>{children}</Link>
  if (onClick) return <button type="button" onClick={onClick} aria-pressed={selected} className={cn(className, 'w-full text-left')} style={style}>{children}</button>
  return <div className={className} style={style}>{children}</div>
}
