import { useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router'
import { ArrowLeft, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { RejectReasonDialog } from '@/components/RejectReasonDialog'
import { ApiError } from '@/lib/api'
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

  if (booking.isPending) return <Skeleton className="h-96 w-full rounded-xl" />
  if (booking.isError) {
    return (
      <div className="py-20 text-center">
        <p className="font-medium">{booking.error instanceof ApiError && booking.error.code === 'not_found' ? 'Booking not found' : 'Couldn’t load this booking'}</p>
        <Button variant="link" render={<Link to="/bookings" />}>Back to Bookings</Button>
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
      toast.error(e instanceof ApiError ? e.message : 'Something went wrong. Please try again.')
    }
  }

  return (
    <>
      <Link to="/bookings" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Bookings
      </Link>

      <div className="mb-6 flex flex-wrap items-center gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{b.code}</h1>
            <BookingStatusPill status={b.status} />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{b.service_name} · {rupees(b.total_paise)}</p>
        </div>
        {isOpen(b.status) && (
          <Button variant="outline" onClick={() => setCancelling(true)} disabled={cancel.isPending}>
            <X /> Cancel booking
          </Button>
        )}
      </div>

      <ReasonBanner booking={b} />

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Parties</CardTitle></CardHeader>
            <CardContent className="grid gap-6 sm:grid-cols-2">
              <div className="space-y-1 text-sm">
                <div className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Customer</div>
                <div className="font-medium">{customerName(b.customer)}</div>
                <div className="text-muted-foreground">{b.customer.phone}</div>
              </div>
              <div className="space-y-1 text-sm">
                <div className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Artist</div>
                <Link to={`/artists/${b.artist.id}`} className="font-medium hover:underline">{b.artist.business_name}</Link>
                <div className="text-muted-foreground">{b.artist.city}</div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Schedule</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <Row label="Service" value={b.service_name} />
              <Row label="Duration" value={duration(b.duration_minutes)} />
              <Row label="When (IST)" value={`${istDateTime(b.start_at)} – ${istTimeOnly(b.end_at)}`} />
              <Separator />
              <Row label="Address" value={b.address} />
              <Row label="Note" value={b.note ?? '—'} />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <PaymentCard booking={b} />
          <Card>
            <CardHeader><CardTitle>Timeline</CardTitle></CardHeader>
            <CardContent><BookingTimeline booking={b} /></CardContent>
          </Card>
        </div>
      </div>

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
    </>
  )
}

/** Why it ended, when someone gave a reason. */
function ReasonBanner({ booking: b }: { booking: AdminBooking }) {
  const reason = b.status === 'cancelled' ? b.cancel_reason : b.status === 'declined' ? b.decline_reason : null
  if (!reason) return null
  return (
    <div className="mb-6 rounded-xl border border-[#F3C9C9] bg-[#FBE3E3] p-4 text-sm text-[#A33A3A]">
      <span className="font-semibold">{b.status === 'cancelled' ? 'Cancelled' : 'Declined'}:</span> {reason}
    </div>
  )
}

function PaymentCard({ booking: b }: { booking: AdminBooking }) {
  return (
    <Card>
      <CardHeader><CardTitle>Payment</CardTitle></CardHeader>
      <CardContent className="space-y-3 text-sm">
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
      </CardContent>
    </Card>
  )
}

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium tabular-nums">{value}</span>
    </div>
  )
}
