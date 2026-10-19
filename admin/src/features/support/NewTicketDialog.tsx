import { useEffect } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { toastError } from '@/lib/notify'
import { useCreateTicket } from './queries'
import { ISSUES, type Topic } from './types'

const E164 = /^\+[1-9]\d{7,14}$/
const SELECT = 'h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50'

const schema = z.object({
  phone: z.string().trim().regex(E164, 'Use the international format, e.g. +919845067890'),
  topic: z.enum(['booking', 'account']),
  issue: z.string().min(1, 'Pick the issue'),
  message: z.string().trim().min(1, 'Write what they told you').max(2000),
})
type FormValues = z.infer<typeof schema>
const empty: FormValues = { phone: '', topic: 'account', issue: 'cant_log_in', message: '' }

/** Design "New ticket": log a phone request about an existing account. Booking problems are reported from the app,
 *  where the customer picks the booking. */
export function NewTicketDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (id: string) => void }) {
  const create = useCreateTicket()
  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: empty })
  const topic = useWatch({ control: form.control, name: 'topic' }) as Topic
  useEffect(() => { if (open) form.reset(empty) }, [open, form])

  const submit = form.handleSubmit((values) =>
    create.mutate(values, {
      onSuccess: (ticket) => { toast.success(`Ticket ${ticket.code} opened`); onCreated(ticket.id) },
      onError: (e) => toastError(e),
    }))

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose() }}>
      <DialogContent>
        <form onSubmit={(e) => { void submit(e) }} noValidate>
          <DialogHeader>
            <DialogTitle>New ticket</DialogTitle>
            <DialogDescription>For a request that came in by phone.</DialogDescription>
          </DialogHeader>
          <FieldGroup className="my-4">
            <Field data-invalid={!!form.formState.errors.phone}>
              <FieldLabel htmlFor="ticket-phone">Requester’s mobile</FieldLabel>
              <Input id="ticket-phone" placeholder="+919845067890" {...form.register('phone')} />
              <FieldError errors={[form.formState.errors.phone]} />
            </Field>
            <Field>
              <FieldLabel htmlFor="ticket-issue">Issue</FieldLabel>
              <select id="ticket-issue" className={SELECT} {...form.register('issue')}>
                {ISSUES[topic].map((i) => <option key={i.value} value={i.value}>{i.label}</option>)}
              </select>
            </Field>
            <Field data-invalid={!!form.formState.errors.message}>
              <FieldLabel htmlFor="ticket-message">What they told you</FieldLabel>
              <Textarea id="ticket-message" rows={4} {...form.register('message')} />
              <FieldError errors={[form.formState.errors.message]} />
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={create.isPending}>{create.isPending ? 'Opening…' : 'Open ticket'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
