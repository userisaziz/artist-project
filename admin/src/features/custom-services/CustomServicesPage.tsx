import { useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { Check, X } from 'lucide-react'
import { toast } from 'sonner'
import { artistPath } from '@/lib/paths'
import { Button } from '@/components/ui/button'
import { FilterChips } from '@/components/FilterChips'
import { PageHeader } from '@/components/PageHeader'
import { GridHeader } from '@/components/console/grid-header'
import { GridMessage } from '@/components/console/grid-message'
import { GridRow } from '@/components/console/grid-row'
import { InitialsAvatar } from '@/components/console/initials-avatar'
import { Panel } from '@/components/console/panel'
import { PanelFooter } from '@/components/console/panel-footer'
import { PanelToolbar } from '@/components/console/panel-toolbar'
import { RejectReasonDialog } from '@/components/RejectReasonDialog'
import { toastError } from '@/lib/notify'
import { dateTime, duration, rupees } from '@/lib/format'
import type { CustomServiceItem, ReviewStatus } from '@/lib/types'
import { useCustomServiceQueue, useDecideCustomService } from './queries'

const TABS: { value: ReviewStatus; label: string; empty: string }[] = [
  { value: 'pending', label: 'Pending', empty: 'No custom services waiting for review.' },
  { value: 'approved', label: 'Approved', empty: 'No approved custom services yet.' },
  { value: 'rejected', label: 'Rejected', empty: 'No rejected custom services.' },
]

/** Services approved artists propose outside the admin's list; each one is approved or rejected on its own. Oldest first. */
export function CustomServicesPage() {
  const [params, setParams] = useSearchParams()
  const status = TABS.find((t) => t.value === params.get('status'))?.value ?? 'pending'
  const queue = useCustomServiceQueue(status)
  const decide = useDecideCustomService()
  const [rejecting, setRejecting] = useState<CustomServiceItem | null>(null)
  const rows = queue.data?.pages.flatMap((p) => p.items) ?? []
  const pending = status === 'pending'
  const columns = pending ? '1.4fr 1.3fr 2fr .8fr .8fr 1fr 190px' : '1.4fr 1.3fr 2fr .8fr .8fr 1fr'

  const run = async (item: CustomServiceItem, decision: { action: 'approve' } | { action: 'reject'; reason: string }) => {
    try {
      await decide.mutateAsync({ id: item.id, decision })
      toast.success(decision.action === 'approve' ? `“${item.name}” is approved and bookable` : `“${item.name}” was sent back with your note`)
      setRejecting(null)
    } catch (e) {
      toastError(e)
    }
  }

  return (
    <>
      <PageHeader title="Custom services" subtitle="Services approved artists add outside your catalog. Check each one before clients can book it." />
      <Panel className="flex flex-col">
        <PanelToolbar>
          <FilterChips tone="primary" chips={TABS} value={status} onChange={(value) => setParams({ status: value })} />
        </PanelToolbar>
        <GridHeader columns={columns} labels={['Artist', 'Category', 'Service', 'Price', 'Duration', 'Submitted', ...(pending ? [''] : [])]} />
        {queue.isPending && <GridMessage state="loading" />}
        {queue.isError && <GridMessage state="error">Couldn’t load custom services. {queue.error.message}</GridMessage>}
        {queue.isSuccess && rows.length === 0 && <GridMessage state="empty">{TABS.find((t) => t.value === status)?.empty}</GridMessage>}
        {rows.map((s) => (
          <GridRow key={s.id} columns={columns}>
            <Link to={artistPath(s.artist_id)} className="flex min-w-0 items-center gap-2.5 hover:opacity-80">
              <InitialsAvatar name={s.business_name} />
              <span className="truncate font-bold">{s.business_name}</span>
            </Link>
            {/* Older rows point straight at a top-level category, so there's no parent to show. */}
            <span className="truncate">{s.category ? `${s.category.name} › ${s.subcategory.name}` : s.subcategory.name}</span>
            <div className="min-w-0">
              <div className="truncate font-bold">{s.name}</div>
              {s.description && <div className="truncate text-[11.5px] text-muted-foreground">{s.description}</div>}
              {s.rejection_reason && <div className="text-[11.5px] text-destructive">Sent back: {s.rejection_reason}</div>}
            </div>
            <span className="tabular-nums">{rupees(s.price_paise)}</span>
            <span>{duration(s.duration_minutes)}</span>
            <span className="text-muted-foreground">{dateTime(s.created_at)}</span>
            {pending && (
              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" aria-label={`Reject ${s.name}`} onClick={() => setRejecting(s)} disabled={decide.isPending}>
                  <X /> Reject
                </Button>
                <Button size="sm" aria-label={`Approve ${s.name}`} onClick={() => { void run(s, { action: 'approve' }) }} disabled={decide.isPending}>
                  <Check /> Approve
                </Button>
              </div>
            )}
          </GridRow>
        ))}
        {queue.isSuccess && rows.length > 0 && (
          <PanelFooter
            end={queue.hasNextPage && (
              <Button variant="link" size="xs" onClick={() => { void queue.fetchNextPage() }} disabled={queue.isFetchingNextPage}>
                {queue.isFetchingNextPage ? 'Loading…' : 'Load more'}
              </Button>
            )}
          >
            Showing {rows.length}{queue.hasNextPage ? '+' : ''}
          </PanelFooter>
        )}
      </Panel>

      <RejectReasonDialog
        open={rejecting !== null}
        title={`Reject “${rejecting?.name ?? ''}”?`}
        description={`${rejecting?.business_name ?? 'The artist'} sees this note in the app and can edit the service to send it again.`}
        placeholder="e.g. This is already in the catalog as Bridal Classic — please add it from the list instead."
        pending={decide.isPending}
        onClose={() => setRejecting(null)}
        onSubmit={(reason) => { if (rejecting) void run(rejecting, { action: 'reject', reason }) }}
      />
    </>
  )
}
