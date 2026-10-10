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
import { ApiError } from '@/lib/api'
import type { AdminCategory } from '@/lib/types'
import { useSaveCategory } from './queries'

const schema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100),
  slug: z
    .string()
    .trim()
    .max(50)
    .regex(/^([a-z0-9]+(-[a-z0-9]+)*)?$/, 'Lowercase letters, digits and single hyphens only'),
  sort_order: z.string().trim().regex(/^\d*$/, 'A whole number'),
  is_active: z.boolean(),
})
type FormValues = z.infer<typeof schema>

const empty: FormValues = { name: '', slug: '', sort_order: '', is_active: true }

/** Create (category = null) or edit a category. Blank slug/order are filled in by the server. */
export function CategoryDialog({ open, category, onClose }: { open: boolean; category: AdminCategory | null; onClose: () => void }) {
  const save = useSaveCategory()
  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: empty })

  useEffect(() => {
    if (!open) return
    form.reset(
      category
        ? { name: category.name, slug: category.slug, sort_order: String(category.sort_order), is_active: category.is_active }
        : empty,
    )
  }, [open, category, form])

  const submit = form.handleSubmit(async (values) => {
    const input = {
      name: values.name,
      is_active: values.is_active,
      ...(values.slug ? { slug: values.slug } : {}),
      ...(values.sort_order ? { sort_order: Number(values.sort_order) } : {}),
    }
    try {
      await save.mutateAsync({ id: category?.id, input })
      toast.success(category ? 'Category updated' : `“${values.name}” created`)
      onClose()
    } catch (e) {
      const message = e instanceof ApiError ? e.message : 'Something went wrong. Please try again.'
      if (e instanceof ApiError && e.code === 'conflict') form.setError('name', { message })
      else toast.error(message)
    }
  })

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} noValidate>
          <DialogHeader>
            <DialogTitle>{category ? 'Edit category' : 'New category'}</DialogTitle>
            <DialogDescription>Artists pick categories during onboarding; customers browse by them.</DialogDescription>
          </DialogHeader>
          <FieldGroup className="py-5">
            <Field data-invalid={!!form.formState.errors.name}>
              <FieldLabel htmlFor="category-name">Name</FieldLabel>
              <Input id="category-name" autoFocus placeholder="Mehendi" aria-invalid={!!form.formState.errors.name} {...form.register('name')} />
              <FieldError errors={[form.formState.errors.name]} />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field data-invalid={!!form.formState.errors.slug}>
                <FieldLabel htmlFor="category-slug">Slug</FieldLabel>
                <Input id="category-slug" placeholder="auto" aria-invalid={!!form.formState.errors.slug} {...form.register('slug')} />
                <FieldError errors={[form.formState.errors.slug]} />
              </Field>
              <Field data-invalid={!!form.formState.errors.sort_order}>
                <FieldLabel htmlFor="category-order">Order</FieldLabel>
                <Input id="category-order" inputMode="numeric" placeholder="last" aria-invalid={!!form.formState.errors.sort_order} {...form.register('sort_order')} />
                <FieldError errors={[form.formState.errors.sort_order]} />
              </Field>
            </div>
            <Field orientation="horizontal">
              <Controller
                control={form.control}
                name="is_active"
                render={({ field }) => <Switch id="category-active" checked={field.value} onCheckedChange={field.onChange} />}
              />
              <div>
                <FieldLabel htmlFor="category-active">Active</FieldLabel>
                <FieldDescription>Inactive categories are hidden from the apps.</FieldDescription>
              </div>
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={save.isPending}>{save.isPending ? 'Saving…' : category ? 'Save changes' : 'Create category'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
