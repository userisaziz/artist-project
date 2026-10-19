import { Select } from "@base-ui/react/select"
import { Check, ChevronDown } from "lucide-react"
import { cn } from "cn"

export interface FilterOption<T extends string> {
  value: T
  label: string
}

interface FilterSelectProps<T extends string> {
  label: string
  value: T
  options: FilterOption<T>[]
  onValueChange: (value: T) => void
  className?: string
}

/** The console top bar's compact dropdown (city, date range): a pill trigger and a checked list. */
function FilterSelect<T extends string>({ label, value, options, onValueChange, className }: FilterSelectProps<T>) {
  return (
    <Select.Root
      items={options}
      value={value}
      onValueChange={(next) => { if (next !== null) onValueChange(next) }}
    >
      <Select.Trigger
        aria-label={label}
        className={cn(
          "flex h-[34px] cursor-pointer items-center gap-1.5 rounded-[10px] border border-input bg-card px-3 text-[12.5px] font-semibold text-foreground outline-none select-none focus-visible:ring-[3px] focus-visible:ring-halo data-popup-open:bg-halo",
          className
        )}
      >
        <Select.Value />
        <Select.Icon className="text-primary">
          <ChevronDown className="size-3.5" strokeWidth={2.5} />
        </Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Positioner alignItemWithTrigger={false} align="end" sideOffset={6} className="z-50 outline-none">
          <Select.Popup className="w-[200px] rounded-[14px] border border-line bg-card p-1.5 shadow-[0_12px_32px_rgba(182,77,117,0.16)] outline-none">
            <Select.List>
              {options.map((o) => (
                <Select.Item
                  key={o.value}
                  value={o.value}
                  className="flex cursor-pointer items-center justify-between rounded-[9px] px-2.5 py-[9px] text-[13px] font-medium text-foreground outline-none select-none data-highlighted:bg-halo data-selected:font-bold data-selected:text-primary"
                >
                  <Select.ItemText>{o.label}</Select.ItemText>
                  <Select.ItemIndicator>
                    <Check className="size-3.5" strokeWidth={2.5} />
                  </Select.ItemIndicator>
                </Select.Item>
              ))}
            </Select.List>
          </Select.Popup>
        </Select.Positioner>
      </Select.Portal>
    </Select.Root>
  )
}

export { FilterSelect }
