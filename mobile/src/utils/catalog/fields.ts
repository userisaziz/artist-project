import type { FieldAnswer, FieldDef, FieldValue } from '../../types/catalog/catalog';

const TEXT_MAX = 300; // backend app/catalog/fields.py TEXT_MAX
const LONG_TEXT_MAX = 2000;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export type FieldValues = Record<string, FieldValue | undefined>;

const isEmpty = (v: FieldValue | undefined) => v === undefined || v === '' || (Array.isArray(v) && v.length === 0);

/** One value checked like the server does; the message names the field. Null when it's fine. */
function problem(f: FieldDef, v: FieldValue): string | null {
  switch (f.type) {
    case 'text':
    case 'long_text':
      return String(v).trim().length > (f.type === 'text' ? TEXT_MAX : LONG_TEXT_MAX) ? `“${f.label}” is too long` : null;
    case 'number': {
      const n = Number(v);
      if (typeof v !== 'number' || Number.isNaN(n)) return `Enter a number for “${f.label}”`;
      if ((f.min !== null && n < f.min) || (f.max !== null && n > f.max)) {
        return f.min !== null && f.max !== null ? `“${f.label}” must be between ${f.min} and ${f.max}` : `Check “${f.label}”`;
      }
      return null;
    }
    case 'date':
      return ISO_DATE.test(String(v)) && !Number.isNaN(Date.parse(String(v))) ? null : `Enter “${f.label}” as YYYY-MM-DD`;
    default:
      return null; // choices and yes/no can only be picked from what's offered
  }
}

/** The answers ready to send (empty ones dropped, text trimmed), or the first problem to show. Mirrors the server,
 *  which checks again. */
export function checkAnswers(fields: FieldDef[], values: FieldValues): { answers: Record<string, FieldValue>; error: string | null } {
  const answers: Record<string, FieldValue> = {};
  for (const f of fields) {
    const raw = values[f.key];
    const v = typeof raw === 'string' ? raw.trim() : raw;
    if (v === undefined || isEmpty(v)) {
      if (f.required) return { answers, error: `“${f.label}” is required` };
      continue;
    }
    const issue = problem(f, v);
    if (issue) return { answers, error: issue };
    answers[f.key] = v;
  }
  return { answers, error: null };
}

/** An answer as one line of text: "300 photos", "Wrists, Elbows", "Yes". */
export function formatAnswer(a: Pick<FieldAnswer, 'value' | 'unit'>): string {
  const v = a.value;
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  if (Array.isArray(v)) return v.join(', ');
  return a.unit ? `${v} ${a.unit}` : String(v);
}

/** Saved values back into a form's state: only keys the current fields still have. */
export function valuesFor(fields: FieldDef[], saved: Record<string, FieldValue> | undefined): FieldValues {
  const out: FieldValues = {};
  for (const f of fields) if (saved && saved[f.key] !== undefined) out[f.key] = saved[f.key];
  return out;
}
