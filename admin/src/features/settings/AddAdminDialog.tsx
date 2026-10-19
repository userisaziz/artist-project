import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { toastError } from '@/lib/notify'
import { useAddAdmin } from './queries'

const schema = z.object({ phone: z.string().trim().regex(/^\+[1-9]\d{6,14}$/, 'Use the international format, e.g. +919845067890') })
type FormValues = z.infer<typeof schema>

/** Give an existing account (they've signed in once) admin access. */
export function AddAdminDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const add = useAddAdmin()
  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { phone: '' } })
  useEffect(() => { if (open) form.reset({ phone: '' }) }, [open, form])

  const submit = form.handleSubmit(({ phone }) =>
    add.mutate(phone, {
      onSuccess: (member) => { toast.success(`${member.name} is now an admin`); onClose() },
      onError: (e) => toastError(e),
    }))

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose() }}>
      <DialogContent>
        <form onSubmit={(e) => { void submit(e) }} noValidate>
          <DialogHeader>
            <DialogTitle>Add an admin</DialogTitle>
            <DialogDescription>They need an Atelier account first: ask them to sign in once with this number.</DialogDescription>
          </DialogHeader>
          <FieldGroup className="my-4">
            <Field data-invalid={!!form.formState.errors.phone}>
              <FieldLabel htmlFor="admin-phone">Mobile</FieldLabel>
              <Input id="admin-phone" placeholder="+919845067890" {...form.register('phone')} />
              <FieldError errors={[form.formState.errors.phone]} />
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={add.isPending}>{add.isPending ? 'Adding…' : 'Add admin'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
