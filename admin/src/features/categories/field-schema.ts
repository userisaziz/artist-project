import { z } from 'zod'
import type { FieldDef, FieldScope, FieldType } from '@/lib/types'

export const SCOPE_LABEL: Record<FieldScope, string> = {
  listing: 'Artist states it',
  booking: 'Customer answers it',
}

export const TYPE_LABEL: Record<FieldType, string> = {
  text: 'Short text',
  long_text: 'Long text',
  number: 'Number',
  select: 'One choice',
  multi_select: 'Several choices',
  boolean: 'Yes / no',
  date: 'Date',
}

export const CHOICE_TYPES: FieldType[] = ['select', 'multi_select']

/** A key suggested from a label: "Baby's name" → "babys_name". Kept once saved, since answers are stored by key. */
export function keyFromLabel(label: string): string {
  const key = label.toLowerCase().replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
  return (/^[a-z]/.test(key) ? key : `f_${key}`).slice(0, 40)
}

const optionalNumber = z.string().trim().regex(/^(-?\d+(\.\d+)?)?$/, 'A number')

/** One field as edited in the form: options as one comma-separated line, numbers as text. */
export const fieldFormSchema = z
  .object({
    key: z.string().regex(/^[a-z][a-z0-9_]{1,39}$/, 'Lowercase letters, digits and _ ; starts with a letter'),
    saved: z.boolean(), // the key already exists on the server: locked
    label: z.string().trim().min(1, 'Label is required').max(60),
    scope: z.enum(['listing', 'booking']),
    type: z.enum(['text', 'long_text', 'number', 'select', 'multi_select', 'boolean', 'date']),
    required: z.boolean(),
    options: z.string().max(900),
    min: optionalNumber,
    max: optionalNumber,
    unit: z.string().trim().max(12),
    help: z.string().trim().max(120),
  })
  .superRefine((f, ctx) => {
    const options = splitOptions(f.options)
    if (CHOICE_TYPES.includes(f.type) && options.length === 0) ctx.addIssue({ code: 'custom', path: ['options'], message: 'Add at least one option' })
    if (options.some((o) => o.length > 40)) ctx.addIssue({ code: 'custom', path: ['options'], message: 'Options are at most 40 characters' })
    if (f.min && f.max && Number(f.min) > Number(f.max)) ctx.addIssue({ code: 'custom', path: ['max'], message: 'Below the minimum' })
  })

export const rulesFormSchema = z
  .object({
    fulfilment: z.enum(['inherit', 'appointment', 'made_to_order']),
    fields: z.array(fieldFormSchema).max(20, 'At most 20 fields'),
  })
  .superRefine((v, ctx) => {
    const keys = v.fields.map((f) => f.key)
    keys.forEach((k, i) => {
      if (keys.indexOf(k) !== i) ctx.addIssue({ code: 'custom', path: ['fields', i, 'key'], message: 'Used by another field' })
    })
  })

export type FieldForm = z.infer<typeof fieldFormSchema>
export type RulesForm = z.infer<typeof rulesFormSchema>

export function splitOptions(line: string): string[] {
  return line.split(',').map((o) => o.trim()).filter(Boolean)
}

export function newField(): FieldForm {
  return { key: '', saved: false, label: '', scope: 'booking', type: 'text', required: false, options: '', min: '', max: '', unit: '', help: '' }
}

export function toForm(f: FieldDef): FieldForm {
  return {
    key: f.key,
    saved: true,
    label: f.label,
    scope: f.scope,
    type: f.type,
    required: f.required,
    options: f.options.join(', '),
    min: f.min === null ? '' : String(f.min),
    max: f.max === null ? '' : String(f.max),
    unit: f.unit ?? '',
    help: f.help ?? '',
  }
}

/** The form's field back into the API shape, keeping only what its type uses. */
export function toApi(f: FieldForm): FieldDef {
  const number = f.type === 'number'
  return {
    key: f.key,
    label: f.label.trim(),
    scope: f.scope,
    type: f.type,
    required: f.required,
    options: CHOICE_TYPES.includes(f.type) ? splitOptions(f.options) : [],
    min: number && f.min ? Number(f.min) : null,
    max: number && f.max ? Number(f.max) : null,
    unit: number && f.unit ? f.unit : null,
    help: f.help || null,
  }
}
