import { useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router'
import { ChevronLeft } from 'lucide-react'
import { toast } from 'sonner'
import { PATHS, artistPath } from '@/lib/paths'
import { InitialsAvatar } from '@/components/console/initials-avatar'
import { Panel } from '@/components/console/panel'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { RejectReasonDialog } from '@/components/RejectReasonDialog'
import { ApiError } from '@/lib/api'
import { toastError } from '@/lib/notify'
import { duration, istDateTime, istTimeOnly, rupees } from '@/lib/format'
import type { AdminBooking } from '@/lib/types'
import { BookingTimeline } from './BookingTimeline'
import { useBooking, useCancelBooking } from './queries'
import { BookingStatusPill } from './BookingStatusPill'
import { customerName, isOpen } from './status'

export function BookingDetailPage() {
  const { id = '' } = useParams()
  const booking = useBooking(id)
  const cancel = useCancelBooking(id)
  const [cancelling, setCancelling] = useState(false)

  if (booking.isPending) return <Skeleton className="h-96 w-full rounded-2xl" />
  if (booking.isError) {
    return (
      <div className="py-20 text-center">
        <p className="font-medium">{booking.error instanceof ApiError && booking.error.code === 'not_found' ? 'Booking not found' : 'Couldn’t load this booking'}</p>
        <Button variant="link" render={<Link to={PATHS.bookings} />}>Back to Bookings</Button>
      </div>
    )
  }

  const b = booking.data
  const submitCancel = async (reason: string) => {
    try {
      await cancel.mutateAsync(reason)
      toast.success(`${b.code} is cancelled and the customer’s deposit is due back`)
      setCancelling(false)
    } catch (e) {
      toastError(e)
    }
  }

  const details: [string, ReactNode][] = [
    ['Customer', customerName(b.customer)],
    ['Customer phone', b.customer.phone],
    ['Artist', <Link key="artist" to={artistPath(b.artist.id)} className="hover:text-primary">{b.artist.business_name}</Link>],
    ['Service', b.service_name],
    ['Duration', duration(b.duration_minutes)],
    ['When (IST)', `${istDateTime(b.start_at)} – ${istTimeOnly(b.end_at)}`],
    ['City', b.artist.city],
    ['Address', b.address],
    ['Note', b.note ?? '—'],
  ]

  return (
    <div className="flex flex-col gap-4">
      <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-[13px]">
        <Link to={PATHS.bookings} className="flex items-center gap-1.5 font-semibold text-primary hover:text-primary-hover"><ChevronLeft className="size-4" /> Bookings</Link>
        <span aria-hidden className="text-faint">/</span>
        <span className="text-muted-foreground">{b.code}</span>
      </nav>

      <Panel className="flex items-center gap-4 px-[22px] py-5">
        <InitialsAvatar name={customerName(b.customer)} size={64} />
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-bold tracking-[0.1em] text-primary uppercase">Booking</div>
          <div className="mt-0.5 flex items-center gap-2.5">
            <h1 className="text-[26.5px] leading-[1.05] font-semibold tracking-[-0.025em]">{b.code}</h1>
            <BookingStatusPill status={b.status} />
          </div>
          <p className="mt-1 text-[13px] text-muted-foreground">{b.service_name} · {b.artist.business_name} · {rupees(b.total_paise)}</p>
        </div>
        {isOpen(b.status) && (
          <Button variant="outline" className="h-[42px] rounded-xl px-[18px] text-[13.5px] font-semibold text-destructive" onClick={() => setCancelling(true)} disabled={cancel.isPending}>
            Cancel booking
          </Button>
        )}
      </Panel>

      <ReasonBanner booking={b} />

      <Tabs defaultValue="details" className="gap-4">
        <TabsList variant="line" className="h-auto w-full justify-start gap-1 rounded-none border-b border-line p-0">
          <TabsTrigger value="details" className="flex-none px-3.5 py-2.5 text-[13.5px]">Details</TabsTrigger>
          <TabsTrigger value="payment" className="flex-none px-3.5 py-2.5 text-[13.5px]">Payment</TabsTrigger>
        </TabsList>
        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
          <div>
            <TabsContent value="details">
              <Panel className="px-5 py-[18px]">
                <h2 className="mb-3.5 text-sm font-bold">Details</h2>
                <dl className="grid grid-cols-3 gap-x-5 gap-y-4">
                  {details.map(([label, value]) => (
                    <div key={label} className="min-w-0">
                      <dt className="text-[11.5px] text-muted-foreground">{label}</dt>
                      <dd className="mt-[3px] text-sm font-semibold break-words">{value}</dd>
                    </div>
                  ))}
                </dl>
              </Panel>
            </TabsContent>
            <TabsContent value="payment"><PaymentCard booking={b} /></TabsContent>
          </div>
          <Panel className="px-5 py-[18px]">
            <h2 className="mb-3 text-sm font-bold">Timeline</h2>
            <BookingTimeline booking={b} />
          </Panel>
        </div>
      </Tabs>

      <RejectReasonDialog
        open={cancelling}
        title={`Cancel ${b.code}?`}
        description={`${customerName(b.customer)} and ${b.artist.business_name} see this note. The customer’s deposit is marked for a full refund.`}
        placeholder="e.g. The artist is unwell and can’t make it."
        label="Reason"
        submitLabel="Cancel booking"
        dismissLabel="Keep booking"
        requiredMessage="Add a reason for cancelling."
        pending={cancel.isPending}
        onClose={() => setCancelling(false)}
        onSubmit={(reason) => { void submitCancel(reason) }}
      />
    </div>
  )
}

/** Why it ended, when someone gave a reason. */
function ReasonBanner({ booking: b }: { booking: AdminBooking }) {
  const reason = b.status === 'cancelled' ? b.cancel_reason : b.status === 'declined' ? b.decline_reason : null
  if (!reason) return null
  return (
    <div className="rounded-xl bg-danger-soft p-3.5 text-[13px] text-destructive">
      <span className="font-semibold">{b.status === 'cancelled' ? 'Cancelled' : 'Declined'}:</span> {reason}
    </div>
  )
}

function PaymentCard({ booking: b }: { booking: AdminBooking }) {
  return (
    <Panel className="px-5 py-[18px]">
      <h2 className="mb-3.5 text-sm font-bold">Payment</h2>
      <div className="space-y-3 text-[13px]">
        <Row label="Service" value={rupees(b.subtotal_paise)} />
        <Row label="Platform fee" value={b.platform_fee_paise ? rupees(b.platform_fee_paise) : 'Waived'} />
        <Row label="Total" value={<span className="font-semibold">{rupees(b.total_paise)}</span>} />
        <Separator />
        <Row label="Deposit paid" value={b.deposit_paid_at ? rupees(b.deposit_paise) : '—'} />
        <Row label="Balance" value={rupees(b.balance_paise)} />
        <Separator />
        <Row label="Commission" value={rupees(b.commission_paise)} />
        <Row label="Artist earns" value={rupees(b.artist_earning_paise)} />
        {b.refund_due !== null && <Row label="Refund due" value={b.refund_due ? 'Yes' : 'No'} />}
      </div>
    </Panel>
  )
}

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-semibold tabular-nums">{value}</span>
    </div>
  )
}
