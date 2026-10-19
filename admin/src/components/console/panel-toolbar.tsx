import type { ReactNode } from 'react'

/** The chip row along the top of a table panel. */
export function PanelToolbar({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-center gap-2 border-b border-line px-3.5 py-3">{children}</div>
}
