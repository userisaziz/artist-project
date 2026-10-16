import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { PageHeader } from '@/components/PageHeader'
import { dateTime, istDateTime, rupees } from '@/lib/format'
import { useDebouncedValue } from '@/lib/use-debounced-value'
import { cn } from '@/lib/utils'
import type { BookingStatus } from '@/lib/types'
import { useBookings } from './queries'
import { BookingStatusPill } from './BookingStatusPill'
import { BOOKING_STATUSES, customerName, isBookingStatus } from './status'

const SEARCH_DEBOUNCE_MS = 300
const COLUMNS = 6
const CHIPS: { value: BookingStatus | null; label: string }[] = [{ value: null, label: 'All' }, ...BOOKING_STATUSES]

/** Every booking on the platform, newest first, filtered by status and searchable by code, phone or artist. */
export function BookingsPage() {
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const raw = params.get('status')
  const status = isBookingStatus(raw) ? raw : null
  const [search, setSearch] = useState('')
  const q = useDebouncedValue(search.trim(), SEARCH_DEBOUNCE_MS)
  const list = useBookings({ status, q })
  const rows = list.data?.pages.flatMap((p) => p.items) ?? []

  return (
    <>
      <PageHeader title="Bookings" subtitle="All service bookings, live and past." />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-2">
          {CHIPS.map((c) => {
            const active = c.value === status
            return (
              <button
                key={c.label}
                type="button"
                aria-pressed={active}
                onClick={() => setParams(c.value ? { status: c.value } : {})}
                className={cn(
                  'rounded-full border px-3 py-1 text-sm font-medium transition-colors',
                  active ? 'border-primary bg-primary text-primary-foreground' : 'bg-card hover:bg-muted',
                )}
              >
                {c.label}
              </button>
            )
          })}
        </div>
        <div className="relative ml-auto w-full max-w-xs">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            aria-label="Search bookings"
            placeholder="Code, phone or artist"
            className="pl-8"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4">Booking</TableHead>
              <TableHead>Artist · service</TableHead>
              <TableHead>When (IST)</TableHead>
              <TableHead>City</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead className="pr-4">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.isPending &&
              Array.from({ length: 4 }, (_, i) => (
                <TableRow key={i}><TableCell colSpan={COLUMNS} className="pl-4"><Skeleton className="h-9 w-full" /></TableCell></TableRow>
              ))}
            {list.isError && (
              <TableRow><TableCell colSpan={COLUMNS} className="py-10 text-center text-destructive">Couldn’t load bookings. {list.error.message}</TableCell></TableRow>
            )}
            {list.isSuccess && rows.length === 0 && (
              <TableRow><TableCell colSpan={COLUMNS} className="py-12 text-center text-muted-foreground">{q ? `No bookings match “${q}”.` : 'No bookings here yet.'}</TableCell></TableRow>
            )}
            {rows.map((b) => (
              <TableRow key={b.id} className="cursor-pointer" onClick={() => navigate(`/bookings/${b.id}`)}>
                <TableCell className="pl-4">
                  <div className="font-medium">
                    <Link to={`/bookings/${b.id}`} className="hover:underline" onClick={(e) => e.stopPropagation()}>{b.code}</Link>
                    <span className="text-muted-foreground"> · {customerName(b.customer)}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">Requested {dateTime(b.created_at)}</div>
                </TableCell>
                <TableCell>
                  <div className="font-medium">{b.artist.business_name}</div>
                  <div className="text-xs text-muted-foreground">{b.service_name}</div>
                </TableCell>
                <TableCell>{istDateTime(b.start_at)}</TableCell>
                <TableCell>{b.artist.city}</TableCell>
                <TableCell className="text-right font-medium tabular-nums">{rupees(b.total_paise)}</TableCell>
                <TableCell className="pr-4"><BookingStatusPill status={b.status} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {list.hasNextPage && (
        <div className="mt-4 flex justify-center">
          <Button variant="outline" onClick={() => { void list.fetchNextPage() }} disabled={list.isFetchingNextPage}>
            {list.isFetchingNextPage ? 'Loading…' : 'Load more'}
          </Button>
        </div>
      )}
    </>
  )
}
