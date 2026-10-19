import type { ReactNode } from 'react'

/** Muted line under a table: counts on the left, paging on the right. */
export function PanelFooter({ children, end }: { children: ReactNode; end?: ReactNode }) {
  return (
    <div className="flex items-center justify-between border-t border-line px-4 py-2.5 text-xs text-muted-foreground">
      <span>{children}</span>
      {end}
    </div>
  )
}
