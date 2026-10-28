import { useState } from 'react'
import { useSearchParams } from 'react-router'
import { Download, Search } from 'lucide-react'
import { FilterChips, type Chip } from '@/components/FilterChips'
import { PageHeader } from '@/components/PageHeader'
import { GridHeader } from '@/components/console/grid-header'
import { GridMessage } from '@/components/console/grid-message'
import { GridRow } from '@/components/console/grid-row'
import { InitialsAvatar } from '@/components/console/initials-avatar'
import { KpiTile } from '@/components/console/kpi-tile'
import { Panel } from '@/components/console/panel'
import { PanelFooter } from '@/components/console/panel-footer'
import { PanelToolbar } from '@/components/console/panel-toolbar'
import { Button } from '@/components/ui/button'
import { dateTime } from '@/lib/format'
import { toastError } from '@/lib/notify'
import { customerPath } from '@/lib/paths'
import { useDebouncedValue } from '@/lib/use-debounced-value'
import { CustomerStatusPill } from './CustomerStatusPill'
import { saveTextFile } from '@/lib/download'
import { exportCustomers, useCustomerSummary, useCustomers } from './queries'
import type { CustomerRow, CustomerSegment } from './types'
import { brand } from '@/lib/brand'

const SEARCH_DEBOUNCE_MS = 300
const COLUMNS = '2.2fr 1fr .8fr 1.2fr 1fr .9fr .6fr'
const SEGMENTS: CustomerSegment[] = ['all', 'new', 'repeat', 'blocked']
const SEGMENT_LABEL: Record<CustomerSegment, string> = { all: 'All', new: 'New this month', repeat: 'Repeat', blocked: 'Blocked' }
const number = new Intl.NumberFormat('en-IN')

const isSegment = (value: string | null): value is CustomerSegment => SEGMENTS.includes(value as CustomerSegment)

/** Design "Customers": people booking artists. Segments, search by name, phone or email, and a CSV export. */
export function CustomersPage() {
  const [params, setParams] = useSearchParams()
  const raw = params.get('segment')
  const segment = isSegment(raw) ? raw : 'all'
  const search = params.get('q') ?? ''
  const q = useDebouncedValue(search.trim(), SEARCH_DEBOUNCE_MS)
  const list = useCustomers(segment, q)
  const summary = useCustomerSummary().data
  const [exporting, setExporting] = useState(false)
  const rows = list.data?.pages.flatMap((p) => p.items) ?? []
  const chips: Chip<CustomerSegment>[] = SEGMENTS.map((s) => ({
    value: s,
    label: summary ? `${SEGMENT_LABEL[s]} ${number.format(summary.counts[s])}` : SEGMENT_LABEL[s],
  }))

  const update = (key: 'segment' | 'q', value: string | null) =>
    setParams((prev) => {
      const next = new URLSearchParams(prev)
      if (value && value !== 'all') next.set(key, value)
      else next.delete(key)
      return next
    }, { replace: key === 'q' })

  const download = async () => {
    setExporting(true)
    try {
      saveTextFile(await exportCustomers(segment, q), 'customers.csv')
    } catch (e) {
      toastError(e)
    } finally {
      setExporting(false)
    }
  }

  return (
    <>
      <PageHeader
        title="Customers"
        subtitle={`People booking artists on ${brand.name}.`}
        action={
          <Button variant="outline" size="page" onClick={() => { void download() }} disabled={exporting}>
            <Download aria-hidden className="size-4" /> {exporting ? 'Exporting…' : 'Export CSV'}
          </Button>
        }
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiTile label="Customers" value={summary && number.format(summary.counts.all)} note={summary && `${number.format(summary.counts.new)} new this month`} tone="up" />
        <KpiTile label="Monthly active" value={summary && number.format(summary.monthly_active)} note="Requested a booking · 30d" />
        <KpiTile label="Repeat rate" value={summary && (summary.repeat_rate === null ? '—' : `${Math.round(summary.repeat_rate * 100)}%`)} note="Of customers who booked" />
        <KpiTile label="Blocked" value={summary && number.format(summary.counts.blocked)} note="Can’t book until unblocked" tone="warn" />
      </div>
      <Panel className="flex flex-col">
        <PanelToolbar>
          <FilterChips chips={chips} value={segment} onChange={(next) => update('segment', next)} />
          <span className="flex-1" />
          <label className="flex h-[30px] items-center gap-1.5 rounded-[10px] border border-line px-3 text-xs font-semibold text-muted-foreground focus-within:ring-[3px] focus-within:ring-halo">
            <Search aria-hidden className="size-3.5" />
            <input
              type="search"
              aria-label="Search customers"
              placeholder="Name, phone or email"
              value={search}
              onChange={(e) => update('q', e.target.value)}
              className="w-44 bg-transparent text-foreground outline-none placeholder:text-muted-foreground"
            />
          </label>
        </PanelToolbar>
        <GridHeader columns={COLUMNS} labels={['Customer', 'City', 'Bookings', 'Last booking', 'Joined', 'Status', '']} />
        {list.isPending && <GridMessage state="loading" />}
        {list.isError && !list.data && <GridMessage state="error">Couldn’t load customers. {list.error.message}</GridMessage>}
        {list.isSuccess && rows.length === 0 && <GridMessage state="empty">{q ? `No customers match “${q}”.` : 'No customers here yet.'}</GridMessage>}
        {rows.map((c) => <CustomerGridRow key={c.id} customer={c} />)}
        {list.isSuccess && rows.length > 0 && (
          <PanelFooter
            end={list.hasNextPage && (
              <Button variant="link" size="xs" onClick={() => { void list.fetchNextPage() }} disabled={list.isFetchingNextPage}>
                {list.isFetchingNextPage ? 'Loading…' : 'Load more'}
              </Button>
            )}
          >
            Showing {number.format(rows.length)}{list.hasNextPage ? '+' : ''}
          </PanelFooter>
        )}
      </Panel>
    </>
  )
}

function CustomerGridRow({ customer: c }: { customer: CustomerRow }) {
  return (
    <GridRow columns={COLUMNS} to={customerPath(c.id)}>
      <div className="flex min-w-0 items-center gap-2.5">
        <InitialsAvatar name={c.name} />
        <div className="min-w-0">
          <div className="truncate font-bold">{c.name}</div>
          <div className="truncate text-[11.5px] text-muted-foreground">{c.phone}</div>
        </div>
      </div>
      <span className="truncate">{c.city ?? '—'}</span>
      <span className="tabular-nums">{number.format(c.bookings)}</span>
      <span className="truncate">{dateTime(c.last_booking_at)}</span>
      <span className="truncate">{dateTime(c.joined_at)}</span>
      <span><CustomerStatusPill status={c.status} /></span>
      <span className="text-right text-[12.5px] font-bold text-primary">View</span>
    </GridRow>
  )
}
