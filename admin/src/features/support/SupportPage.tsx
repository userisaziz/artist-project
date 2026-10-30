import { useState } from 'react'
import { useSearchParams } from 'react-router'
import { Plus } from 'lucide-react'
import { FilterChips, type Chip } from '@/components/FilterChips'
import { PageHeader } from '@/components/PageHeader'
import { CellLabel } from '@/components/console/cell-label'
import { GridHeader } from '@/components/console/grid-header'
import { GridMessage } from '@/components/console/grid-message'
import { GridRow } from '@/components/console/grid-row'
import { InitialsAvatar } from '@/components/console/initials-avatar'
import { KpiTile } from '@/components/console/kpi-tile'
import { Panel } from '@/components/console/panel'
import { PanelFooter } from '@/components/console/panel-footer'
import { PanelToolbar } from '@/components/console/panel-toolbar'
import { Button } from '@/components/ui/button'
import { useRevealWhenStacked } from '@/lib/use-reveal-when-stacked'
import { NewTicketDialog } from './NewTicketDialog'
import { TicketPanel } from './TicketPanel'
import { TicketStatusPill } from './TicketStatusPill'
import { useQueue, useSupportSummary } from './queries'
import type { QueueView, Ticket } from './types'
import { waitingFor } from './waiting'

const COLUMNS = '2fr 1.8fr .8fr .8fr 1fr .6fr'
const VIEWS: QueueView[] = ['open', 'mine', 'artists', 'customers', 'urgent', 'resolved']
const VIEW_LABEL: Record<QueueView, string> = { open: 'Open', mine: 'Mine', artists: 'Artists', customers: 'Customers', urgent: 'Urgent', resolved: 'Resolved' }
const number = new Intl.NumberFormat('en-IN')
const isView = (value: string | null): value is QueueView => VIEWS.includes(value as QueueView)

/** Design "Support": tickets from customers and artists, worked from a queue with the ticket open beside it. */
export function SupportPage() {
  const [params, setParams] = useSearchParams()
  const raw = params.get('view')
  const view = isView(raw) ? raw : 'open'
  const selected = params.get('ticket')
  const paneRef = useRevealWhenStacked<HTMLDivElement>(selected)
  const queue = useQueue(view)
  const summary = useSupportSummary().data
  const [creating, setCreating] = useState(false)
  const rows = queue.data?.pages.flatMap((p) => p.items) ?? []
  const now = queue.dataUpdatedAt // "waiting" is measured from when the queue was last read
  const chips: Chip<QueueView>[] = VIEWS.map((v) => ({ value: v, label: summary ? `${VIEW_LABEL[v]} ${number.format(summary.counts[v])}` : VIEW_LABEL[v] }))

  const set = (key: 'view' | 'ticket', value: string | null) =>
    setParams((prev) => {
      const next = new URLSearchParams(prev)
      if (value) next.set(key, value)
      else next.delete(key)
      return next
    })

  return (
    <>
      <PageHeader
        title="Support"
        subtitle="Tickets from customers and artists, from the app and by phone."
        action={<Button size="page" onClick={() => setCreating(true)}><Plus aria-hidden className="size-4" /> New ticket</Button>}
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiTile label="Open tickets" value={summary && number.format(summary.counts.open)} note={summary && `${number.format(summary.counts.urgent)} urgent`} tone={summary?.counts.urgent ? 'alert' : 'muted'} />
        <KpiTile label="First response" value={summary && (summary.first_response_minutes === null ? '—' : `${Math.round(summary.first_response_minutes)} min`)} note="Median · 30 days" />
        <KpiTile label="Resolved · 7d" value={summary && number.format(summary.resolved_7d)} tone="up" />
        <KpiTile label="Assigned to me" value={summary && number.format(summary.counts.mine)} note="Still open" />
      </div>
      <div className={selected ? 'grid gap-4 xl:grid-cols-[1fr_420px]' : ''}>
        <Panel className="flex flex-col">
          <PanelToolbar>
            <FilterChips chips={chips} value={view} onChange={(next) => set('view', next)} />
          </PanelToolbar>
          <GridHeader columns={COLUMNS} labels={['Ticket', 'Subject', 'Channel', 'Waiting', 'Status', '']} />
          {queue.isPending && <GridMessage state="loading" />}
          {queue.isError && !queue.data && <GridMessage state="error">Couldn’t load the queue. {queue.error.message}</GridMessage>}
          {queue.isSuccess && rows.length === 0 && <GridMessage state="empty">Nothing here. Nice work.</GridMessage>}
          {rows.map((t) => <TicketRow key={t.id} ticket={t} now={now} selected={t.id === selected} onOpen={() => set('ticket', t.id)} />)}
          {queue.isSuccess && rows.length > 0 && (
            <PanelFooter
              end={queue.hasNextPage && (
                <Button variant="link" size="xs" onClick={() => { void queue.fetchNextPage() }} disabled={queue.isFetchingNextPage}>
                  {queue.isFetchingNextPage ? 'Loading…' : 'Load more'}
                </Button>
              )}
            >
              Showing {number.format(rows.length)}{queue.hasNextPage ? '+' : ''}
            </PanelFooter>
          )}
        </Panel>
        {selected && <div ref={paneRef} className="scroll-mt-4"><TicketPanel ticketId={selected} onClose={() => set('ticket', null)} /></div>}
      </div>
      <NewTicketDialog open={creating} onClose={() => setCreating(false)} onCreated={(id) => { setCreating(false); set('ticket', id) }} />
    </>
  )
}

function TicketRow({ ticket: t, now, selected, onOpen }: { ticket: Ticket; now: number; selected: boolean; onOpen: () => void }) {
  return (
    <GridRow columns={COLUMNS} onClick={onOpen} selected={selected}>
      <div className="flex min-w-0 items-center gap-2.5">
        <InitialsAvatar name={t.requester.name} />
        <div className="min-w-0">
          <div className="truncate font-bold">{t.code} · {t.requester.name}</div>
          <div className="truncate text-[11.5px] text-muted-foreground capitalize">{t.requester.side}</div>
        </div>
      </div>
      <span className="truncate">{t.subject}</span>
      <span className="capitalize">{t.channel}</span>
      <span className="tabular-nums"><CellLabel>Waiting</CellLabel>{waitingFor(t.waiting_since, now)}</span>
      <span><TicketStatusPill ticket={t} /></span>
      <span className="text-right text-[12.5px] font-bold text-primary max-md:hidden">{t.status === 'resolved' ? 'View' : 'Reply'}</span>
    </GridRow>
  )
}
