import { useEffect } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { ApiError } from '@/lib/api'
import { toastError } from '@/lib/notify'
import type { AdminCategory, ServiceTemplate } from '@/lib/types'
import { useSaveServiceTemplate } from './queries'

const schema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(120),
  description: z.string().trim().max(1000),
  sort_order: z.string().trim().regex(/^\d*$/, 'A whole number'),
  is_active: z.boolean(),
})
type FormValues = z.infer<typeof schema>

const empty: FormValues = { name: '', description: '', sort_order: '', is_active: true }

/** Create (template = null) or edit one service in a subcategory's list. A blank order puts it last. */
export function ServiceTemplateDialog({ open, subcategory, template, onClose }: {
  open: boolean
  subcategory: AdminCategory
  template: ServiceTemplate | null
  onClose: () => void
}) {
  const save = useSaveServiceTemplate()
  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: empty })

  useEffect(() => {
    if (!open) return
    form.reset(
      template
        ? { name: template.name, description: template.description ?? '', sort_order: String(template.sort_order), is_active: template.is_active }
        : empty,
    )
  }, [open, template, form])

  const submit = form.handleSubmit(async (values) => {
    const input = {
      name: values.name,
      description: values.description || null, // blank clears it
      is_active: values.is_active,
      ...(values.sort_order ? { sort_order: Number(values.sort_order) } : {}),
      ...(template ? {} : { subcategory_id: subcategory.id }),
    }
    try {
      await save.mutateAsync({ id: template?.id, input })
      toast.success(template ? 'Service updated' : `“${values.name}” added to ${subcategory.name}`)
      onClose()
    } catch (e) {
      if (e instanceof ApiError && e.code === 'conflict') form.setError('name', { message: e.message })
      else toastError(e)
    }
  })

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} noValidate>
          <DialogHeader>
            <DialogTitle>{template ? 'Edit service' : 'New service'}</DialogTitle>
            <DialogDescription>Artists in {subcategory.name} pick from this list and set their own price and duration.</DialogDescription>
          </DialogHeader>
          <FieldGroup className="py-5">
            <Field data-invalid={!!form.formState.errors.name}>
              <FieldLabel htmlFor="template-name">Name</FieldLabel>
              <Input id="template-name" autoFocus placeholder="Airbrush bridal look" aria-invalid={!!form.formState.errors.name} {...form.register('name')} />
              <FieldError errors={[form.formState.errors.name]} />
            </Field>
            <Field data-invalid={!!form.formState.errors.description}>
              <FieldLabel htmlFor="template-description">Description</FieldLabel>
              <Textarea id="template-description" rows={3} placeholder="Optional" aria-invalid={!!form.formState.errors.description} {...form.register('description')} />
              <FieldError errors={[form.formState.errors.description]} />
            </Field>
            <Field data-invalid={!!form.formState.errors.sort_order}>
              <FieldLabel htmlFor="template-order">Order</FieldLabel>
              <Input id="template-order" inputMode="numeric" placeholder="last" aria-invalid={!!form.formState.errors.sort_order} {...form.register('sort_order')} />
              <FieldError errors={[form.formState.errors.sort_order]} />
            </Field>
            <Field orientation="horizontal">
              <Controller
                control={form.control}
                name="is_active"
                render={({ field }) => <Switch id="template-active" checked={field.value} onCheckedChange={field.onChange} />}
              />
              <div>
                <FieldLabel htmlFor="template-active">Active</FieldLabel>
                <FieldDescription>Inactive services can’t be picked; artists who offer one keep it.</FieldDescription>
              </div>
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={save.isPending}>{save.isPending ? 'Saving…' : template ? 'Save changes' : 'Add service'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
