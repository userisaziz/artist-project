import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import { Textarea } from '@/components/ui/textarea'

/** Wording for the form; the defaults are the artist-review ones. */
interface ReasonCopy {
  label?: string
  submitLabel?: string
  dismissLabel?: string
  requiredMessage?: string
}

/** Asks for a required reason (backend RejectIn: 1–500 characters): rejecting an artist or service, or cancelling a booking. */
export function RejectReasonDialog({ open, title, description, placeholder, pending, onClose, onSubmit, ...copy }: ReasonCopy & {
  open: boolean
  title: string
  description: string
  placeholder: string
  pending: boolean
  onClose: () => void
  onSubmit: (reason: string) => void
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {/* The content unmounts when closed, so each opening starts with a blank reason. */}
        <ReasonForm {...copy} placeholder={placeholder} pending={pending} onClose={onClose} onSubmit={onSubmit} />
      </DialogContent>
    </Dialog>
  )
}

function ReasonForm({
  label = 'What needs fixing',
  submitLabel = 'Reject',
  dismissLabel = 'Cancel',
  requiredMessage = 'Tell the artist what to fix.',
  placeholder, pending, onClose, onSubmit,
}: ReasonCopy & {
  placeholder: string
  pending: boolean
  onClose: () => void
  onSubmit: (reason: string) => void
}) {
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)

  const submit = () => {
    const text = reason.trim()
    if (!text) return setError(requiredMessage)
    onSubmit(text)
  }

  return (
    <>
      <Field data-invalid={!!error}>
        <FieldLabel htmlFor="reject-reason">{label}</FieldLabel>
        <Textarea
          id="reject-reason"
          autoFocus
          rows={4}
          maxLength={500}
          placeholder={placeholder}
          value={reason}
          aria-invalid={!!error}
          onChange={(e) => { setReason(e.target.value); setError(null) }}
        />
        <FieldError>{error}</FieldError>
      </Field>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>{dismissLabel}</Button>
        <Button variant="destructive" onClick={submit} disabled={pending}>{pending ? 'Sending…' : submitLabel}</Button>
      </DialogFooter>
    </>
  )
}
