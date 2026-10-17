import { useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { toast } from 'sonner'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Field, FieldLabel } from '@/components/ui/field'
import { Textarea } from '@/components/ui/textarea'
import { ApiError } from '@/lib/api'
import { dateTime } from '@/lib/format'
import type { AdminReview, ReviewDecision } from '@/lib/types'
import { useDecideReview } from './queries'
import { ReviewStatusPill } from './ReviewStatusPill'
import { FLAGS, decisionsFor, reviewParties } from './status'

const NOTE_MAX_LENGTH = 500

const DECISIONS: Record<ReviewDecision, { label: string; done: string; variant: 'default' | 'outline' | 'destructive' }> = {
  publish: { label: 'Publish', done: 'Review published', variant: 'default' },
  hide: { label: 'Hide', done: 'Review hidden', variant: 'outline' },
  remove: { label: 'Remove', done: 'Review removed', variant: 'destructive' },
}

/** A right-hand panel over the queue: the whole review, why it is here, and the moderator's decision. */
export function ReviewDetailPanel({ review, onClose, onDecided }: {
  review: AdminReview | null
  onClose: () => void
  onDecided: (review: AdminReview) => void
}) {
  return (
    <Dialog open={review !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="top-0 right-0 left-auto flex h-svh w-full max-w-md translate-x-0 translate-y-0 flex-col gap-0 overflow-y-auto rounded-none p-0 sm:max-w-md data-open:zoom-in-100 data-closed:zoom-out-100">
        {/* Keyed by review, so the note starts afresh for each one. */}
        {review && <ReviewDetail key={review.id} review={review} onDecided={onDecided} />}
      </DialogContent>
    </Dialog>
  )
}

function ReviewDetail({ review: r, onDecided }: { review: AdminReview; onDecided: (review: AdminReview) => void }) {
  const decide = useDecideReview()
  const [note, setNote] = useState(r.moderator_note ?? '')
  const [confirmingRemove, setConfirmingRemove] = useState(false)
  const decisions = decisionsFor(r.status)

  const submit = async (decision: ReviewDecision) => {
    try {
      const updated = await decide.mutateAsync({ id: r.id, decision, note: note.trim() || undefined })
      toast.success(DECISIONS[decision].done)
      onDecided(updated)
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Something went wrong. Please try again.')
    } finally {
      setConfirmingRemove(false)
    }
  }
  const choose = (decision: ReviewDecision) => (decision === 'remove' ? setConfirmingRemove(true) : void submit(decision))

  return (
    <>
      <DialogHeader className="border-b p-5 pr-12">
        <DialogTitle className="text-lg font-semibold">{reviewParties(r)}</DialogTitle>
        <DialogDescription>{r.service_name} · {dateTime(r.created_at)}</DialogDescription>
        <div className="flex items-center gap-2 text-sm">
          <span className="font-semibold tabular-nums">★ {r.rating}</span>
          <ReviewStatusPill status={r.status} />
        </div>
      </DialogHeader>

      <div className="flex-1 space-y-5 p-5 text-sm">
        {r.flag && (
          <div className="rounded-lg border border-[#F1DDB8] bg-[#FDF0DC] p-3 text-[#9A6514]">
            <div className="font-semibold">{FLAGS[r.flag].explanation}</div>
            {r.report_reason && <p className="mt-1">{r.report_reason}</p>}
          </div>
        )}
        <Section label="Review"><p className="whitespace-pre-wrap">{r.text ?? 'No text, just a rating.'}</p></Section>
        <Section label="Artist’s reply">
          {r.reply ? <p className="whitespace-pre-wrap">{r.reply}</p> : <p className="text-muted-foreground">No reply yet.</p>}
        </Section>
        <div className="grid grid-cols-2 gap-4">
          <Section label="Booking">
            <Link to={`/bookings/${r.booking.id}`} className="font-medium text-primary hover:underline">{r.booking.code}</Link>
            <div className="text-muted-foreground">{r.booking.service_name}</div>
          </Section>
          <Section label="Customer">
            <div className="font-medium">{r.customer.name ?? 'Customer'}</div>
            <div className="text-muted-foreground">{r.customer.phone}</div>
          </Section>
          <Section label="Artist">
            <Link to={`/artists/${r.artist.id}`} className="font-medium hover:underline">{r.artist.business_name}</Link>
          </Section>
          {r.moderated_at && <Section label="Last decision">{dateTime(r.moderated_at)}</Section>}
        </div>
        {decisions.length > 0 && (
          <Field>
            <FieldLabel htmlFor="moderator-note">Internal note</FieldLabel>
            <Textarea
              id="moderator-note"
              rows={3}
              maxLength={NOTE_MAX_LENGTH}
              placeholder="Only admins see this."
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </Field>
        )}
        {decisions.length === 0 && r.moderator_note && <Section label="Internal note"><p className="whitespace-pre-wrap">{r.moderator_note}</p></Section>}
      </div>

      {decisions.length > 0 && (
        <div className="flex justify-end gap-2 border-t bg-muted/50 p-4">
          {decisions.map((d) => (
            <Button key={d} variant={DECISIONS[d].variant} disabled={decide.isPending} onClick={() => choose(d)}>{DECISIONS[d].label}</Button>
          ))}
        </div>
      )}

      <AlertDialog open={confirmingRemove} onOpenChange={(open) => !open && setConfirmingRemove(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this review?</AlertDialogTitle>
            <AlertDialogDescription>It disappears from {r.artist.business_name}’s profile for good. This can’t be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction variant="destructive" disabled={decide.isPending} onClick={() => { void submit('remove') }}>Remove review</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

function Section({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1">
      <div className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{label}</div>
      {children}
    </div>
  )
}
