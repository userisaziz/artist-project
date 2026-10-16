import { istDateTime, istTimeOnly, rupees } from '@/lib/format'
import type { AdminBooking } from '@/lib/types'
import { cn } from '@/lib/utils'

interface Step {
  label: string
  at?: string | null
  hint?: string
  done: boolean
}

const WHO: Record<NonNullable<AdminBooking['cancelled_by']>, string> = { customer: 'the customer', artist: 'the artist', admin: 'an admin' }

/** The artist's answer: accepted, declined, ignored until it expired, or still pending. */
function responseStep(b: AdminBooking): Step | null {
  switch (b.status) {
    case 'requested':
      return { label: 'Waiting for the artist', hint: `Expires ${istTimeOnly(b.expires_at)} IST`, done: false }
    case 'confirmed':
    case 'completed':
      return { label: 'Accepted by the artist', at: b.responded_at, done: true }
    case 'declined':
      return { label: 'Declined by the artist', at: b.responded_at, done: true }
    case 'expired':
      return { label: 'No answer in time, expired', at: b.expires_at, done: true }
    case 'cancelled':
      // Without responded_at there's no telling whether it was accepted before the cancel.
      return b.responded_at ? { label: 'Accepted by the artist', at: b.responded_at, done: true } : null
  }
}

function endStep(b: AdminBooking): Step | null {
  if (b.status === 'completed') return { label: 'Completed', at: b.completed_at, done: true }
  if (b.status === 'cancelled') return { label: `Cancelled by ${b.cancelled_by ? WHO[b.cancelled_by] : 'someone'}`, at: b.cancelled_at, done: true }
  return null
}

function stepsOf(b: AdminBooking): Step[] {
  const steps: (Step | null)[] = [
    { label: 'Booking requested', at: b.created_at, done: true },
    b.deposit_paid_at ? { label: `Deposit paid · ${rupees(b.deposit_paise)}`, at: b.deposit_paid_at, done: true } : null,
    responseStep(b),
    endStep(b),
  ]
  return steps.filter((s): s is Step => s !== null)
}

/** requested → deposit paid → responded → completed / cancelled, with IST times where the API has them. */
export function BookingTimeline({ booking }: { booking: AdminBooking }) {
  return (
    <ol className="space-y-4">
      {stepsOf(booking).map((s) => (
        <li key={s.label} className="flex gap-3">
          <span className={cn('mt-1.5 size-2.5 shrink-0 rounded-full', s.done ? 'bg-primary' : 'border-2 border-primary bg-card')} />
          <div>
            <div className="text-sm font-medium">{s.label}</div>
            {(s.at || s.hint) && <div className="text-xs text-muted-foreground">{s.at ? istDateTime(s.at) : s.hint}</div>}
          </div>
        </li>
      ))}
    </ol>
  )
}
