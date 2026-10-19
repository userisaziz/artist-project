import { useSearchParams } from 'react-router'
import { Search } from 'lucide-react'
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
import { dateTime, istDateTime, rupees } from '@/lib/format'
import { bookingPath } from '@/lib/paths'
import { trend } from '@/lib/trend'
import { useDebouncedValue } from '@/lib/use-debounced-value'
import type { AdminBooking, BookingStatus } from '@/lib/types'
import { BookingStatusPill } from './BookingStatusPill'
import { useBookingKpis, useBookings } from './queries'
import { BOOKING_STATUSES, customerName, isBookingStatus } from './status'

const SEARCH_DEBOUNCE_MS = 300
const COLUMNS = '2fr 1.6fr 1.2fr 1fr .9fr 1fr .7fr'
const CHIPS: Chip<BookingStatus | null>[] = [{ value: null, label: 'All' }, ...BOOKING_STATUSES]
const number = new Intl.NumberFormat('en-IN')

/** Every booking on the platform, newest first, filtered by status and searchable by code, phone or artist. */
export function BookingsPage() {
  const [params, setParams] = useSearchParams()
  const raw = params.get('status')
  const status = isBookingStatus(raw) ? raw : null
  const search = params.get('q') ?? ''
  const q = useDebouncedValue(search.trim(), SEARCH_DEBOUNCE_MS)
  const list = useBookings({ status, q })
  const rows = list.data?.pages.flatMap((p) => p.items) ?? []

  const update = (key: 'status' | 'q', value: string | null) =>
    setParams((prev) => {
      const next = new URLSearchParams(prev)
      if (value) next.set(key, value)
      else next.delete(key)
      return next
    }, { replace: key === 'q' })

  return (
    <>
      <PageHeader title="Bookings" subtitle="All service bookings, live and past." />
      <BookingKpis />
      <Panel className="flex flex-col">
        <PanelToolbar>
          <FilterChips chips={CHIPS} value={status} onChange={(next) => update('status', next)} />
          <span className="flex-1" />
          <label className="flex h-[30px] items-center gap-1.5 rounded-[10px] border border-line px-3 text-xs font-semibold text-muted-foreground focus-within:ring-[3px] focus-within:ring-halo">
            <Search aria-hidden className="size-3.5" />
            <input
              type="search"
              aria-label="Filter bookings"
              placeholder="Filter rows"
              value={search}
              onChange={(e) => update('q', e.target.value)}
              className="w-40 bg-transparent text-foreground outline-none placeholder:text-muted-foreground"
            />
          </label>
        </PanelToolbar>
        <GridHeader columns={COLUMNS} labels={['Booking', 'Artist · service', 'When (IST)', 'City', 'Amount', 'Status', '']} />
        {list.isPending && <GridMessage state="loading" />}
        {list.isError && <GridMessage state="error">Couldn’t load bookings. {list.error.message}</GridMessage>}
        {list.isSuccess && rows.length === 0 && <GridMessage state="empty">{q ? `No bookings match “${q}”.` : 'No bookings here yet.'}</GridMessage>}
        {rows.map((b) => <BookingRow key={b.id} booking={b} />)}
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

function BookingKpis() {
  const o = useBookingKpis().data
  const bookings = o ? trend(o.bookings, o.bookings_previous) : { tone: 'muted' as const }
  const cancelRate = o && o.bookings > 0 ? `${((o.cancelled / o.bookings) * 100).toFixed(1)}%` : o && '0%'
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <KpiTile label="Bookings · 30d" value={o && number.format(o.bookings)} note={bookings.note} tone={bookings.tone} />
      <KpiTile label="Completed · 30d" value={o && number.format(o.completed)} note={o && `${rupees(o.gross_paise)} gross`} />
      <KpiTile label="Cancellations" value={cancelRate} note={o && `${number.format(o.cancelled)} in 30 days`} />
      <KpiTile label="Awaiting artist" value={o && number.format(o.awaiting_artist)} note="Requests not yet answered" tone="warn" />
    </div>
  )
}

function BookingRow({ booking: b }: { booking: AdminBooking }) {
  const customer = customerName(b.customer)
  return (
    <GridRow columns={COLUMNS} to={bookingPath(b.id)}>
      <div className="flex min-w-0 items-center gap-2.5">
        <InitialsAvatar name={customer} />
        <div className="min-w-0">
          <div className="truncate font-bold">{b.code} · {customer}</div>
          <div className="truncate text-[11.5px] text-muted-foreground">Created {dateTime(b.created_at)}</div>
        </div>
      </div>
      <span className="truncate">{b.artist.business_name} · {b.service_name}</span>
      <span className="truncate">{istDateTime(b.start_at)}</span>
      <span className="truncate">{b.artist.city}</span>
      <span className="truncate tabular-nums">{rupees(b.total_paise)}</span>
      <span><BookingStatusPill status={b.status} /></span>
      <span className="text-right text-[12.5px] font-bold text-primary">Open</span>
    </GridRow>
  )
}
