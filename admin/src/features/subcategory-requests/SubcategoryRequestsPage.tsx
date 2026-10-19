import { useState } from 'react'
import { useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { FilterChips } from '@/components/FilterChips'
import { PageHeader } from '@/components/PageHeader'
import { RejectReasonDialog } from '@/components/RejectReasonDialog'
import { GridHeader } from '@/components/console/grid-header'
import { GridMessage } from '@/components/console/grid-message'
import { KpiTile } from '@/components/console/kpi-tile'
import { Panel } from '@/components/console/panel'
import { PanelFooter } from '@/components/console/panel-footer'
import { PanelToolbar } from '@/components/console/panel-toolbar'
import { Button } from '@/components/ui/button'
import { ApiError } from '@/lib/api'
import { toastError } from '@/lib/notify'
import { ApproveRequestDialog } from './ApproveRequestDialog'
import { useDecideSubcategoryRequest, useSubcategoryRequestSummary, useSubcategoryRequests } from './queries'
import { RequestRow } from './RequestRow'
import type { RequestStatus, SubcategoryRequest } from './types'

const COLUMNS = '2fr 1.2fr 1.8fr 1fr 1fr 170px'
const HOUR_MS = 3_600_000
const number = new Intl.NumberFormat('en-IN')

const FILTERS: { value: RequestStatus; label: string }[] = [
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
]

const EMPTY: Record<RequestStatus, string> = {
  pending: 'No suggestions waiting. Artists can suggest one when they add a custom service.',
  approved: 'No approved suggestions yet.',
  rejected: 'No rejected suggestions.',
}

/** "Oldest 18h" for the KPI note. */
function age(iso: string | null) {
  if (!iso) return undefined
  const hours = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / HOUR_MS))
  return hours < 48 ? `Oldest ${hours}h` : `Oldest ${Math.round(hours / 24)}d`
}

/** The design's Subcategory requests: what artists suggested while adding a service, approved into the catalog or not. */
export function SubcategoryRequestsPage() {
  const [params, setParams] = useSearchParams()
  const status = FILTERS.find((f) => f.value === params.get('status'))?.value ?? 'pending'
  const list = useSubcategoryRequests(status)
  const summary = useSubcategoryRequestSummary().data
  const decide = useDecideSubcategoryRequest()
  const [approving, setApproving] = useState<SubcategoryRequest | null>(null)
  const [approveError, setApproveError] = useState<string | null>(null)
  const [rejecting, setRejecting] = useState<SubcategoryRequest | null>(null)
  const rows = list.data?.pages.flatMap((p) => p.items) ?? []
  const chips = FILTERS.map((f) => ({ value: f.value, label: summary ? `${f.label} ${number.format(summary.counts[f.value])}` : f.label }))

  const approve = async (request: SubcategoryRequest, name: string) => {
    setApproveError(null)
    try {
      await decide.mutateAsync({ id: request.id, decision: { action: 'approve', name } })
      toast.success(`“${name}” is in the catalog under ${request.parent.name}`)
      setApproving(null)
    } catch (e) {
      // A name that already exists under the category answers 409: say so under the field.
      if (e instanceof ApiError && e.code === 'conflict') setApproveError(e.message)
      else toastError(e)
    }
  }

  const reject = async (request: SubcategoryRequest, reason: string) => {
    try {
      await decide.mutateAsync({ id: request.id, decision: { action: 'reject', reason } })
      toast.success(`“${request.name}” was turned down; ${request.artist.business_name} is told why`)
      setRejecting(null)
    } catch (e) {
      toastError(e)
    }
  }

  return (
    <>
      <PageHeader
        title="Subcategory requests"
        subtitle="Artists suggest subcategories when adding a service. Approved ones join the category for every artist."
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiTile label="Pending" value={summary && number.format(summary.counts.pending)} note={summary ? age(summary.oldest_pending_at) : undefined} tone="warn" />
        <KpiTile label="Approved · 30d" value={summary && number.format(summary.approved_30d)} tone="up" />
        <KpiTile label="Admin defaults" value={summary && number.format(summary.admin_defaults)} note="Active subcategories" />
        <KpiTile label="Rejected" value={summary && number.format(summary.counts.rejected)} note="All time" />
      </div>
      <Panel className="flex flex-col">
        <PanelToolbar>
          <FilterChips chips={chips} value={status} onChange={(next) => setParams(next === 'pending' ? {} : { status: next })} />
        </PanelToolbar>
        <GridHeader columns={COLUMNS} labels={['Subcategory', 'Category', 'Suggested by', 'Services waiting', 'Status', '']} />
        {list.isPending && <GridMessage state="loading" />}
        {list.isError && <GridMessage state="error">Couldn’t load subcategory requests. {list.error.message}</GridMessage>}
        {list.isSuccess && rows.length === 0 && <GridMessage state="empty">{EMPTY[status]}</GridMessage>}
        {rows.map((r) => (
          <RequestRow
            key={r.id}
            request={r}
            columns={COLUMNS}
            busy={decide.isPending}
            onApprove={() => { setApproveError(null); setApproving(r) }}
            onReject={() => setRejecting(r)}
          />
        ))}
        {list.isSuccess && rows.length > 0 && (
          <PanelFooter
            end={list.hasNextPage && (
              <Button variant="link" size="xs" onClick={() => { void list.fetchNextPage() }} disabled={list.isFetchingNextPage}>
                {list.isFetchingNextPage ? 'Loading…' : 'Load more'}
              </Button>
            )}
          >
            Suggestions stay private to the artist until approved.
          </PanelFooter>
        )}
      </Panel>

      <ApproveRequestDialog
        request={approving}
        pending={decide.isPending}
        error={approveError}
        onClose={() => setApproving(null)}
        onApprove={(name) => { if (approving) void approve(approving, name) }}
      />
      <RejectReasonDialog
        open={rejecting !== null}
        title={`Reject “${rejecting?.name ?? ''}”?`}
        description="The artist is told why, and the services waiting on it go back to them to pick an existing subcategory."
        placeholder="e.g. Bridal already covers this; please add it there."
        label="Reason"
        submitLabel="Reject"
        requiredMessage="Add a reason for the artist."
        pending={decide.isPending}
        onClose={() => setRejecting(null)}
        onSubmit={(reason) => { if (rejecting) void reject(rejecting, reason) }}
      />
    </>
  )
}
