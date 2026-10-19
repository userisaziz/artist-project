import type { ReactNode } from 'react'

/** Page title row, as the design's admin console opens every screen. */
export function PageHeader({ title, subtitle, action }: { title: ReactNode; subtitle?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-end gap-3.5">
      <div className="flex-1">
        <h1 className="text-[25px] leading-none font-semibold tracking-[-0.025em]">{title}</h1>
        {subtitle && <p className="mt-1.5 text-[13px] text-muted-foreground">{subtitle}</p>}
      </div>
      {action && <div className="flex gap-2">{action}</div>}
    </div>
  )
}
