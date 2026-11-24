import { ArrowDown, ArrowUp, Trash2 } from 'lucide-react'
import { Controller, useFormContext, useWatch } from 'react-hook-form'
import { Button } from '@/components/ui/button'
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import type { FieldScope, FieldType } from '@/lib/types'
import { CHOICE_TYPES, SCOPE_LABEL, TYPE_LABEL, keyFromLabel, type RulesForm } from './field-schema'
import { RuleSelect } from './RuleSelect'

interface FieldEditorProps {
  index: number
  count: number
  onMove: (from: number, to: number) => void
  onRemove: (index: number) => void
}

/** One admin-defined field in the Service rules panel: label (its key follows until saved), who fills it in, its
 *  type, whether it's required, and the options, range or unit its type takes. */
export function FieldEditor({ index, count, onMove, onRemove }: FieldEditorProps) {
  const { register, control, setValue, formState } = useFormContext<RulesForm>()
  const field = useWatch({ control, name: `fields.${index}` })
  const errors = formState.errors.fields?.[index]
  const id = (part: string) => `field-${index}-${part}`
  const name = field.label || `Field ${index + 1}`

  return (
    <fieldset aria-label={name} className="space-y-3 rounded-lg border border-border p-3">
      <div className="flex items-start gap-2">
        <Field className="flex-1" data-invalid={!!errors?.label}>
          <FieldLabel htmlFor={id('label')}>Label</FieldLabel>
          <Input
            id={id('label')}
            placeholder="Baby's name"
            aria-invalid={!!errors?.label}
            {...register(`fields.${index}.label`, {
              onChange: (e) => { if (!field.saved) setValue(`fields.${index}.key`, keyFromLabel(e.target.value)) },
            })}
          />
          <FieldError errors={[errors?.label]} />
        </Field>
        <div className="flex gap-0.5 pt-6">
          <Button type="button" variant="ghost" size="icon-sm" aria-label={`Move ${name} up`} disabled={index === 0} onClick={() => onMove(index, index - 1)}><ArrowUp /></Button>
          <Button type="button" variant="ghost" size="icon-sm" aria-label={`Move ${name} down`} disabled={index === count - 1} onClick={() => onMove(index, index + 1)}><ArrowDown /></Button>
          <Button type="button" variant="ghost" size="icon-sm" aria-label={`Remove ${name}`} onClick={() => onRemove(index)}><Trash2 /></Button>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Key: <code>{field.key || '—'}</code>{field.saved ? ' (kept: answers are stored under it)' : ''}
      </p>
      <FieldError errors={[errors?.key]} />
      <div className="grid grid-cols-2 gap-3">
        <Field>
          <FieldLabel htmlFor={id('scope')}>Filled in by</FieldLabel>
          <Controller control={control} name={`fields.${index}.scope`} render={({ field: f }) => (
            <RuleSelect id={id('scope')} value={f.value} onChange={(v) => f.onChange(v as FieldScope)} options={SCOPE_LABEL} />
          )} />
        </Field>
        <Field>
          <FieldLabel htmlFor={id('type')}>Type</FieldLabel>
          <Controller control={control} name={`fields.${index}.type`} render={({ field: f }) => (
            <RuleSelect id={id('type')} value={f.value} onChange={(v) => f.onChange(v as FieldType)} options={TYPE_LABEL} />
          )} />
        </Field>
      </div>
      {CHOICE_TYPES.includes(field.type) && (
        <Field data-invalid={!!errors?.options}>
          <FieldLabel htmlFor={id('options')}>Options</FieldLabel>
          <Input id={id('options')} placeholder="Wedding, Eid, Birthday" aria-invalid={!!errors?.options} {...register(`fields.${index}.options`)} />
          <FieldDescription>Separate them with commas.</FieldDescription>
          <FieldError errors={[errors?.options]} />
        </Field>
      )}
      {field.type === 'number' && (
        <div className="grid grid-cols-3 gap-3">
          <Field data-invalid={!!errors?.min}>
            <FieldLabel htmlFor={id('min')}>Min</FieldLabel>
            <Input id={id('min')} inputMode="decimal" {...register(`fields.${index}.min`)} />
            <FieldError errors={[errors?.min]} />
          </Field>
          <Field data-invalid={!!errors?.max}>
            <FieldLabel htmlFor={id('max')}>Max</FieldLabel>
            <Input id={id('max')} inputMode="decimal" {...register(`fields.${index}.max`)} />
            <FieldError errors={[errors?.max]} />
          </Field>
          <Field>
            <FieldLabel htmlFor={id('unit')}>Unit</FieldLabel>
            <Input id={id('unit')} placeholder="photos" {...register(`fields.${index}.unit`)} />
          </Field>
        </div>
      )}
      <Field>
        <FieldLabel htmlFor={id('help')}>Hint (optional)</FieldLabel>
        <Input id={id('help')} placeholder="Shown under the field" {...register(`fields.${index}.help`)} />
      </Field>
      <Controller control={control} name={`fields.${index}.required`} render={({ field: f }) => (
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={f.value} onCheckedChange={f.onChange} aria-label={`${name} is required`} />
          Required
        </label>
      )} />
    </fieldset>
  )
}
