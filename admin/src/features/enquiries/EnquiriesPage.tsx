import { useState } from 'react'
import { useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { FilterChips } from '@/components/FilterChips'
import { PageHeader } from '@/components/PageHeader'
import { GridHeader } from '@/components/console/grid-header'
import { GridMessage } from '@/components/console/grid-message'
import { KpiTile } from '@/components/console/kpi-tile'
import { Panel } from '@/components/console/panel'
import { PanelFooter } from '@/components/console/panel-footer'
import { PanelToolbar } from '@/components/console/panel-toolbar'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { toastError } from '@/lib/notify'
import { EnquiryRow } from './EnquiryRow'
import { useDecideEnquiry, useEnquiries, useEnquirySummary } from './queries'
import type { Enquiry, EnquiryFilter } from './types'

const COLUMNS = '2.2fr 1.1fr 1.3fr 1.3fr .8fr 150px'
const number = new Intl.NumberFormat('en-IN')

const FILTERS: { value: EnquiryFilter; label: string }[] = [
  { value: 'held', label: 'Held' },
  { value: 'hidden', label: 'Hidden' },
  { value: 'allowed', label: 'Allowed' },
  { value: 'all', label: 'All caught' },
]

const EMPTY: Record<EnquiryFilter, string> = {
  held: 'Nothing waiting — no messages are held right now.',
  hidden: 'No hidden messages.',
  allowed: 'No allowed messages yet.',
  all: 'The filter hasn’t caught any messages yet.',
}

/** The design's Enquiries monitor: chat messages held back for sharing contact details or blocked words. */
export function EnquiriesPage() {
  const [params, setParams] = useSearchParams()
  const status = FILTERS.find((f) => f.value === params.get('status'))?.value ?? 'held'
  const list = useEnquiries(status)
  const summary = useEnquirySummary().data
  const decide = useDecideEnquiry()
  const [hiding, setHiding] = useState<Enquiry | null>(null)
  const rows = list.data?.pages.flatMap((p) => p.items) ?? []
  const chips = FILTERS.map((f) => ({
    value: f.value,
    label: summary && f.value !== 'all' ? `${f.label} ${number.format(summary.counts[f.value])}` : f.label,
  }))

  const run = async (enquiry: Enquiry, decision: 'allow' | 'hide') => {
    try {
      await decide.mutateAsync({ id: enquiry.id, decision })
      toast.success(decision === 'allow' ? 'Marked safe and delivered' : 'Message hidden')
      setHiding(null)
    } catch (e) {
      toastError(e)
    }
  }

  return (
    <>
      <PageHeader title="Enquiries monitor" subtitle="Chat messages held back for sharing contact details or using blocked words." />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiTile label="Enquiries · 7d" value={summary && number.format(summary.messages_7d)} note="Customer messages to artists" />
        <KpiTile
          label="Flagged · 7d"
          value={summary && number.format(summary.flagged_7d)}
          note={summary && summary.messages_7d > 0 ? `${((summary.flagged_7d / summary.messages_7d) * 100).toFixed(1)}% of enquiries` : undefined}
          tone="warn"
        />
        <KpiTile label="Waiting for a decision" value={summary && number.format(summary.counts.held)} note="Only the sender sees these" tone="alert" />
        <KpiTile label="Hidden" value={summary && number.format(summary.counts.hidden)} note="Never delivered" />
      </div>
      <Panel className="flex flex-col">
        <PanelToolbar>
          <FilterChips chips={chips} value={status} onChange={(next) => setParams(next === 'held' ? {} : { status: next })} />
        </PanelToolbar>
        <GridHeader columns={COLUMNS} labels={['Message', 'Customer', 'Artist', 'Flag', 'Status', '']} />
        {list.isPending && <GridMessage state="loading" />}
        {list.isError && <GridMessage state="error">Couldn’t load enquiries. {list.error.message}</GridMessage>}
        {list.isSuccess && rows.length === 0 && <GridMessage state="empty">{EMPTY[status]}</GridMessage>}
        {rows.map((e) => (
          <EnquiryRow key={e.id} enquiry={e} columns={COLUMNS} busy={decide.isPending} onAllow={() => { void run(e, 'allow') }} onHide={() => setHiding(e)} />
        ))}
        {list.isSuccess && rows.length > 0 && (
          <PanelFooter
            end={list.hasNextPage && (
              <Button variant="link" size="xs" onClick={() => { void list.fetchNextPage() }} disabled={list.isFetchingNextPage}>
                {list.isFetchingNextPage ? 'Loading…' : 'Load more'}
              </Button>
            )}
          >
            Phone numbers, emails and links are held until an admin allows them.
          </PanelFooter>
        )}
      </Panel>

      <AlertDialog open={hiding !== null} onOpenChange={(open) => !open && setHiding(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hide this message?</AlertDialogTitle>
            <AlertDialogDescription>The artist won’t see it. The sender is told contact details aren’t allowed before booking.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => { if (hiding) void run(hiding, 'hide') }}>Hide</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
