import { CellLabel } from '@/components/console/cell-label'
import { GridRow } from '@/components/console/grid-row'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { dateTime } from '@/lib/format'
import { flagLabel } from './flags'
import type { Enquiry, EnquiryStatus } from './types'

const STATUS: Record<EnquiryStatus, { label: string; tone: 'warning' | 'success' | 'danger' }> = {
  held: { label: 'Held', tone: 'warning' },
  allowed: { label: 'Allowed', tone: 'success' },
  hidden: { label: 'Hidden', tone: 'danger' },
}

interface EnquiryRowProps {
  enquiry: Enquiry
  columns: string
  busy: boolean
  onAllow: () => void
  onHide: () => void
}

/** One caught message: what was said, who to whom, why it was caught, and the decision buttons while held. */
export function EnquiryRow({ enquiry: e, columns, busy, onAllow, onHide }: EnquiryRowProps) {
  const from = e.sender === 'customer' ? e.customer.name : e.artist.name
  return (
    <GridRow columns={columns}>
      <div className="min-w-0">
        <div className="truncate font-bold">“{e.text}”</div>
        <div className="truncate text-[11.5px] text-muted-foreground">From {from} · {dateTime(e.created_at)}</div>
      </div>
      <span className="truncate"><CellLabel>Customer</CellLabel>{e.customer.name}</span>
      <span className="truncate"><CellLabel>Artist</CellLabel>{e.artist.name}</span>
      <span className="truncate">{flagLabel(e.flag)}</span>
      <span><Badge variant={STATUS[e.status].tone}>{STATUS[e.status].label}</Badge></span>
      <div className="flex justify-end gap-2">
        {e.status === 'held' ? (
          <>
            <Button variant="outline" size="sm" className="text-destructive" aria-label={`Hide message from ${from}`} onClick={onHide} disabled={busy}>Hide</Button>
            <Button size="sm" aria-label={`Allow message from ${from}`} onClick={onAllow} disabled={busy}>Allow</Button>
          </>
        ) : (
          <span className="text-[12px] text-muted-foreground">{dateTime(e.moderated_at)}</span>
        )}
      </div>
    </GridRow>
  )
}
