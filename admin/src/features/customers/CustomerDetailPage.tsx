import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { ChevronLeft } from 'lucide-react'
import { toast } from 'sonner'
import { RejectReasonDialog } from '@/components/RejectReasonDialog'
import { InitialsAvatar } from '@/components/console/initials-avatar'
import { Panel } from '@/components/console/panel'
import { GridMessage } from '@/components/console/grid-message'
import { Button } from '@/components/ui/button'
import { dateTime, istDateTime, rupees } from '@/lib/format'
import { toastError } from '@/lib/notify'
import { PATHS, bookingPath } from '@/lib/paths'
import { CustomerStatusPill } from './CustomerStatusPill'
import { useCustomer, useSetBlocked } from './queries'
import type { CustomerDetail } from './types'

/** Design customer detail: breadcrumb, header card with Block / Unblock, the details grid and recent bookings. */
export function CustomerDetailPage() {
  const { id = '' } = useParams()
  const customer = useCustomer(id)
  const c = customer.data

  return (
    <div className="flex flex-col gap-4">
      <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-[13px] text-muted-foreground">
        <Link to={PATHS.customers} className="inline-flex items-center gap-0.5 hover:text-foreground">
          <ChevronLeft aria-hidden className="size-4" /> Customers
        </Link>
        {c && <span aria-current="page">/ {c.name}</span>}
      </nav>
      {customer.isPending && <Panel><GridMessage state="loading" /></Panel>}
      {customer.isError && <Panel><GridMessage state="error">Couldn’t load this customer. {customer.error.message}</GridMessage></Panel>}
      {c && <CustomerView customer={c} />}
    </div>
  )
}

function CustomerView({ customer: c }: { customer: CustomerDetail }) {
  const setBlocked = useSetBlocked(c.id)
  const [blocking, setBlocking] = useState(false)
  const blocked = c.status === 'blocked'

  const block = (reason: string) =>
    setBlocked.mutate(reason, {
      onSuccess: () => { setBlocking(false); toast.success('Account blocked') },
      onError: (e) => toastError(e),
    })
  const unblock = () =>
    setBlocked.mutate(null, { onSuccess: () => toast.success('Account unblocked'), onError: (e) => toastError(e) })

  const details: [string, string][] = [
    ['Phone', c.phone],
    ['Email', c.email ?? '—'],
    ['City', c.city ?? '—'],
    ['Bookings', String(c.bookings)],
    ['Reviews', String(c.reviews)],
    ['Last booking', dateTime(c.last_booking_at)],
    ['Joined', dateTime(c.joined_at)],
  ]

  return (
    <>
      <Panel className="flex items-center gap-4 p-5">
        <InitialsAvatar name={c.name} size={64} />
        <div className="min-w-0 flex-1">
          <div className="text-[11.5px] font-bold tracking-[0.08em] text-muted-foreground uppercase">Customer</div>
          <div className="flex items-center gap-2.5">
            <h1 className="truncate text-[25px] leading-tight font-semibold">{c.name}</h1>
            <CustomerStatusPill status={c.status} />
          </div>
          <div className="text-[13px] text-muted-foreground">{c.phone}{c.city ? ` · ${c.city}` : ''}</div>
        </div>
        {blocked
          ? <Button size="page" onClick={unblock} disabled={setBlocked.isPending}>Unblock</Button>
          : <Button size="page" variant="destructive" onClick={() => setBlocking(true)}>Block</Button>}
      </Panel>

      {blocked && (
        <Panel className="border-destructive/30 p-4 text-[13px]">
          <span className="font-bold text-destructive">Blocked {dateTime(c.blocked_at)}.</span> {c.blocked_reason}
        </Panel>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
        <Panel className="p-5">
          <h2 className="mb-3 text-[15px] font-bold">Details</h2>
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-[13px]">
            {details.map(([label, value]) => (
              <div key={label} className="contents">
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="truncate font-semibold">{value}</dd>
              </div>
            ))}
          </dl>
        </Panel>
        <Panel className="p-5">
          <h2 className="mb-3 text-[15px] font-bold">Recent bookings</h2>
          {c.recent_bookings.length === 0 && <p className="text-[13px] text-muted-foreground">No bookings yet.</p>}
          <ul className="divide-y divide-line">
            {c.recent_bookings.map((b) => (
              <li key={b.id}>
                <Link to={bookingPath(b.id)} className="flex items-center gap-3 py-2.5 text-[13px] hover:bg-row-hover">
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-bold">{b.code} · {b.artist_name}</div>
                    <div className="truncate text-muted-foreground">{b.service_name} · {istDateTime(b.start_at)}</div>
                  </div>
                  <span className="tabular-nums">{rupees(b.total_paise)}</span>
                  <span className="w-24 text-right text-muted-foreground capitalize">{b.status}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <RejectReasonDialog
        open={blocking}
        title={`Block ${c.name}?`}
        description="They will be signed out and can’t book until unblocked."
        placeholder="Why is this account being blocked?"
        label="Reason"
        submitLabel="Block"
        requiredMessage="Add a reason for the team."
        pending={setBlocked.isPending}
        onClose={() => setBlocking(false)}
        onSubmit={block}
      />
    </>
  )
}
