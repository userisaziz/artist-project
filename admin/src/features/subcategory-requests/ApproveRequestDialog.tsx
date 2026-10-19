import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import type { SubcategoryRequest } from './types'

const schema = z.object({ name: z.string().trim().min(1, 'Name is required').max(100) }) // backend Name
type FormValues = z.infer<typeof schema>

interface ApproveRequestDialogProps {
  request: SubcategoryRequest | null
  pending: boolean
  /** Rejects when the name clashes, with the message to show under the field. */
  error: string | null
  onClose: () => void
  onApprove: (name: string) => void
}

/** "Approve & publish", renaming first if the artist's wording needs it. */
export function ApproveRequestDialog({ request, pending, error, onClose, onApprove }: ApproveRequestDialogProps) {
  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { name: '' } })

  useEffect(() => {
    if (request) form.reset({ name: request.name })
  }, [request, form])

  useEffect(() => {
    if (error) form.setError('name', { message: error })
  }, [error, form])

  const submit = form.handleSubmit((values) => onApprove(values.name))
  const nameError = form.formState.errors.name

  return (
    <Dialog open={request !== null} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} noValidate>
          <DialogHeader>
            <DialogTitle>Approve “{request?.name}”?</DialogTitle>
            <DialogDescription>It joins {request?.parent.name} for every artist and shows to customers.</DialogDescription>
          </DialogHeader>
          <FieldGroup className="py-5">
            <Field data-invalid={!!nameError}>
              <FieldLabel htmlFor="request-name">Subcategory name</FieldLabel>
              <Input id="request-name" autoFocus aria-invalid={!!nameError} {...form.register('name')} />
              <FieldError errors={[nameError]} />
              {request?.description && <FieldDescription>Artist’s note: {request.description}</FieldDescription>}
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={pending}>{pending ? 'Saving…' : 'Approve & publish'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
