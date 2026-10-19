import type { ReactNode } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { GridRow } from '@/components/console/grid-row'
import { InitialsAvatar } from '@/components/console/initials-avatar'
import { Badge } from '@/components/ui/badge'
import type { AdminCategory, CategoryStatus } from '@/lib/types'
import { cn } from '@/lib/utils'
import { STATUS_LABEL } from './StatusSelect'

const STATUS_TONE: Record<CategoryStatus, 'success' | 'neutral' | 'warning'> = { active: 'success', draft: 'neutral', inactive: 'warning' }
const number = new Intl.NumberFormat('en-IN')

interface CategoryRowProps {
  category: AdminCategory
  columns: string
  /** Subcategory names under a category; the service count under a subcategory. */
  meta: string
  /** Set for a category row (toggles its subcategories); unset for a subcategory row. */
  expanded?: boolean
  selected?: boolean
  onOpen: () => void
  actions: ReactNode
}

/** One Catalog row: initials tile, name and meta, usage counts, status pill and actions. */
export function CategoryRow({ category: c, columns, meta, expanded, selected = false, onOpen, actions }: CategoryRowProps) {
  const isCategory = expanded !== undefined
  const Chevron = expanded ? ChevronDown : ChevronRight
  return (
    <GridRow columns={columns} selected={selected}>
      <div className={cn('flex min-w-0 items-center gap-2.5', !isCategory && 'pl-10')}>
        {isCategory && <InitialsAvatar name={c.name} />}
        <div className="min-w-0">
          <button
            type="button"
            className="flex max-w-full items-center gap-1 text-left font-bold hover:underline"
            aria-expanded={isCategory ? expanded : undefined}
            aria-pressed={isCategory ? undefined : selected}
            onClick={onOpen}
          >
            <span className="truncate">{c.name}</span>
            {isCategory && <Chevron className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />}
          </button>
          <div className="truncate text-[11.5px] text-muted-foreground">{meta}</div>
        </div>
      </div>
      <span className="tabular-nums">{isCategory ? number.format(c.artist_count) : '—'}</span>
      <span className="tabular-nums">{number.format(c.service_count)}</span>
      <span><Badge variant={STATUS_TONE[c.status]}>{STATUS_LABEL[c.status]}</Badge></span>
      {actions}
    </GridRow>
  )
}
