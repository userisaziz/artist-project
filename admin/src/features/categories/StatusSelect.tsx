import type { CategoryStatus } from '@/lib/types'

export const STATUS_LABEL: Record<CategoryStatus, string> = { draft: 'Draft', inactive: 'Inactive', active: 'Active' }

/** Native select styled like Input; the backend refuses draft for a category that's already in use. */
export function StatusSelect({ id, value, onChange, disabled, label }: {
  id?: string
  value: CategoryStatus
  onChange: (status: CategoryStatus) => void
  disabled?: boolean
  label?: string
}) {
  return (
    <select
      id={id}
      aria-label={label}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value as CategoryStatus)}
      className="h-8 rounded-md border border-input bg-transparent px-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50"
    >
      {(Object.keys(STATUS_LABEL) as CategoryStatus[]).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
    </select>
  )
}
