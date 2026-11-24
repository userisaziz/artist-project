import { useEffect } from 'react'
import { Plus } from 'lucide-react'
import { FormProvider, useFieldArray, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field'
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { toastError } from '@/lib/notify'
import type { AdminCategory, Fulfilment } from '@/lib/types'
import { FieldEditor } from './FieldEditor'
import { SCOPE_LABEL, newField, rulesFormSchema, toApi, toForm, type RulesForm } from './field-schema'
import { RuleSelect } from './RuleSelect'
import { useSaveCategory } from './queries'

const FULFILMENT_LABEL: Record<Fulfilment, string> = {
  appointment: 'Appointment — booked into a time slot',
  made_to_order: 'Made to order — customers ask for a quote',
}

interface ServiceRulesSheetProps {
  /** The category or subcategory being edited; null closes the panel. */
  category: AdminCategory | null
  /** Its top-level category when it is a subcategory (whose rules it inherits). */
  parent: AdminCategory | null
  onClose: () => void
}

/** "Service rules" for a category: how its services are fulfilled, and the fields artists state and customers
 *  answer. A subcategory inherits its parent's fulfilment (unless it sets its own) and fields (shown read-only). */
export function ServiceRulesSheet({ category, parent, onClose }: ServiceRulesSheetProps) {
  const save = useSaveCategory()
  const form = useForm<RulesForm>({ resolver: zodResolver(rulesFormSchema), defaultValues: { fulfilment: 'appointment', fields: [] } })
  const fields = useFieldArray({ control: form.control, name: 'fields' })
  const fulfilment = useWatch({ control: form.control, name: 'fulfilment' })

  useEffect(() => {
    if (!category) return
    form.reset({
      fulfilment: category.fulfilment ?? (parent ? 'inherit' : 'appointment'),
      fields: category.field_schema.map(toForm),
    })
  }, [category, parent, form])

  const fulfilmentOptions: Record<string, string> = parent
    ? { inherit: `Same as ${parent.name} (${parent.fulfilment === 'made_to_order' ? 'made to order' : 'appointment'})`, ...FULFILMENT_LABEL }
    : FULFILMENT_LABEL

  const submit = form.handleSubmit(async (values) => {
    if (!category) return
    try {
      await save.mutateAsync({
        id: category.id,
        input: {
          fulfilment: values.fulfilment === 'inherit' ? null : values.fulfilment,
          field_schema: values.fields.map(toApi),
        },
      })
      toast.success(`Service rules saved for “${category.name}”`)
      onClose()
    } catch (e) {
      toastError(e, 'Could not save the service rules')
    }
  })

  return (
    <Sheet open={category !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <FormProvider {...form}>
          <form onSubmit={submit} noValidate className="flex min-h-full flex-col">
            <SheetHeader>
              <SheetTitle>Service rules · {category?.name}</SheetTitle>
              <SheetDescription>
                How services here are bought, and the details artists state and customers answer. Changes apply to new
                bookings; past ones keep the questions as they were asked.
              </SheetDescription>
            </SheetHeader>
            <div className="flex-1 space-y-5 px-4 pb-4">
              <Field>
                <FieldLabel htmlFor="rules-fulfilment">Fulfilment</FieldLabel>
                <RuleSelect id="rules-fulfilment" value={fulfilment} onChange={(v) => form.setValue('fulfilment', v as RulesForm['fulfilment'])} options={fulfilmentOptions} />
                <FieldDescription>Made to order suits cards, aqiqah boxes, calligraphy frames: no time slot, so there is no Book button.</FieldDescription>
              </Field>

              {parent && parent.field_schema.length > 0 && (
                <section aria-label={`Fields from ${parent.name}`} className="space-y-1.5">
                  <h3 className="text-sm font-semibold">From {parent.name}</h3>
                  <ul className="space-y-1 text-sm text-muted-foreground">
                    {parent.field_schema.map((f) => (
                      <li key={f.key}>{f.label} · {SCOPE_LABEL[f.scope].toLowerCase()}{f.required ? ' · required' : ''}</li>
                    ))}
                  </ul>
                </section>
              )}

              <section aria-label="Fields" className="space-y-3">
                <h3 className="text-sm font-semibold">{parent ? 'Fields for this subcategory' : 'Fields'}</h3>
                {fields.fields.length === 0 && (
                  <p className="text-sm text-muted-foreground">No fields yet. Add what every service here should say, or what customers must tell the artist.</p>
                )}
                {fields.fields.map((f, i) => (
                  <FieldEditor key={f.id} index={i} count={fields.fields.length} onMove={fields.move} onRemove={fields.remove} />
                ))}
                {form.formState.errors.fields?.root && <p className="text-sm text-destructive">{form.formState.errors.fields.root.message}</p>}
                <Button type="button" variant="outline" disabled={fields.fields.length >= 20} onClick={() => fields.append(newField())}><Plus /> Add field</Button>
              </section>
            </div>
            <SheetFooter className="border-t border-border">
              <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
              <Button type="submit" disabled={save.isPending}>{save.isPending ? 'Saving…' : 'Save rules'}</Button>
            </SheetFooter>
          </form>
        </FormProvider>
      </SheetContent>
    </Sheet>
  )
}
