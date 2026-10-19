import { GridRow } from '@/components/console/grid-row'
import { InitialsAvatar } from '@/components/console/initials-avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { dateTime } from '@/lib/format'
import type { RequestStatus, SubcategoryRequest } from './types'

const STATUS: Record<RequestStatus, { label: string; tone: 'warning' | 'success' | 'danger' }> = {
  pending: { label: 'Pending', tone: 'warning' },
  approved: { label: 'Approved', tone: 'success' },
  rejected: { label: 'Rejected', tone: 'danger' },
}

interface RequestRowProps {
  request: SubcategoryRequest
  columns: string
  busy: boolean
  onApprove: () => void
  onReject: () => void
}

/** One suggestion: name and note, where it would sit, who asked, and how many services wait on it. */
export function RequestRow({ request: r, columns, busy, onApprove, onReject }: RequestRowProps) {
  return (
    <GridRow columns={columns}>
      <div className="min-w-0">
        <div className="truncate font-bold">{r.name}</div>
        <div className="truncate text-[11.5px] text-muted-foreground">{r.description ?? `Suggested ${dateTime(r.created_at)}`}</div>
      </div>
      <span className="truncate">{r.parent.name}</span>
      <div className="flex min-w-0 items-center gap-2.5">
        <InitialsAvatar name={r.artist.business_name} />
        <span className="truncate">{r.artist.business_name}</span>
      </div>
      <span className="tabular-nums">{r.services_waiting}</span>
      <span><Badge variant={STATUS[r.status].tone}>{STATUS[r.status].label}</Badge></span>
      <div className="flex justify-end gap-2">
        {r.status === 'pending' ? (
          <>
            <Button variant="outline" size="sm" className="text-destructive" aria-label={`Reject ${r.name}`} onClick={onReject} disabled={busy}>Reject</Button>
            <Button size="sm" aria-label={`Approve ${r.name}`} onClick={onApprove} disabled={busy}>Approve</Button>
          </>
        ) : (
          <span className="truncate text-[12px] text-muted-foreground" title={r.rejection_reason ?? undefined}>{r.rejection_reason ?? dateTime(r.reviewed_at)}</span>
        )}
      </div>
    </GridRow>
  )
}
