import { useEffect } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { ApiError } from '@/lib/api'
import type { AdminCategory } from '@/lib/types'
import { useSaveCategory } from './queries'
import { StatusSelect } from './StatusSelect'

const schema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100),
  slug: z
    .string()
    .trim()
    .max(50)
    .regex(/^([a-z0-9]+(-[a-z0-9]+)*)?$/, 'Lowercase letters, digits and single hyphens only'),
  sort_order: z.string().trim().regex(/^\d*$/, 'A whole number'),
  status: z.enum(['draft', 'inactive', 'active']),
})
type FormValues = z.infer<typeof schema>

const empty: FormValues = { name: '', slug: '', sort_order: '', status: 'draft' }

/**
 * Create (category = null) or edit a category. With `parent` it's a subcategory of that top-level category:
 * shown read-only, and sent as parent_id on create. Blank slug/order are filled in by the server.
 */
export function CategoryDialog({ open, category, parent = null, onClose }: {
  open: boolean
  category: AdminCategory | null
  parent?: AdminCategory | null
  onClose: () => void
}) {
  const save = useSaveCategory()
  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: empty })

  useEffect(() => {
    if (!open) return
    form.reset(
      category
        ? { name: category.name, slug: category.slug, sort_order: String(category.sort_order), status: category.status }
        : empty,
    )
  }, [open, category, form])

  const noun = parent ? 'Subcategory' : 'Category'

  const submit = form.handleSubmit(async (values) => {
    const input = {
      name: values.name,
      status: values.status,
      ...(values.slug ? { slug: values.slug } : {}),
      ...(values.sort_order ? { sort_order: Number(values.sort_order) } : {}),
      ...(parent && !category ? { parent_id: parent.id } : {}),
    }
    try {
      await save.mutateAsync({ id: category?.id, input })
      toast.success(category ? `${noun} updated` : `“${values.name}” created`)
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
            <DialogTitle>{category ? `Edit ${noun.toLowerCase()}` : `New ${noun.toLowerCase()}`}</DialogTitle>
            <DialogDescription>
              {parent ? 'Each subcategory holds the list of services artists pick from.' : 'Artists pick categories during onboarding; customers browse by them.'}
            </DialogDescription>
          </DialogHeader>
          <FieldGroup className="py-5">
            {parent && <p className="text-sm text-muted-foreground">Under: <span className="font-medium text-foreground">{parent.name}</span></p>}
            <Field data-invalid={!!form.formState.errors.name}>
              <FieldLabel htmlFor="category-name">Name</FieldLabel>
              <Input id="category-name" autoFocus placeholder={parent ? 'Bridal' : 'Mehendi'} aria-invalid={!!form.formState.errors.name} {...form.register('name')} />
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
            <Field>
              <FieldLabel htmlFor="category-status">Status</FieldLabel>
              <Controller
                control={form.control}
                name="status"
                render={({ field }) => <StatusSelect id="category-status" value={field.value} onChange={field.onChange} />}
              />
              <FieldDescription>Draft: only admins see it. Inactive: no new picks; artists who have it keep it. Active: live in the apps.</FieldDescription>
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={save.isPending}>{save.isPending ? 'Saving…' : category ? 'Save changes' : `Create ${noun.toLowerCase()}`}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
