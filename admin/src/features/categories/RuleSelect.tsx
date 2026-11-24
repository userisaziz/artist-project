/** Native select styled like Input, for the Service rules panel's fixed choices (label by value). */
export function RuleSelect<T extends string>({ id, value, onChange, options, disabled }: {
  id?: string
  value: T
  onChange: (value: T) => void
  options: Record<T, string>
  disabled?: boolean
}) {
  return (
    <select
      id={id}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value as T)}
      className="h-8 w-full rounded-md border border-input bg-transparent px-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50"
    >
      {(Object.keys(options) as T[]).map((v) => <option key={v} value={v}>{options[v]}</option>)}
    </select>
  )
}
