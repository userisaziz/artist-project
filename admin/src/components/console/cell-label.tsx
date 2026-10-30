import type { ReactNode } from 'react'

/** Names a grid cell's value on the phone card, where the column header is hidden. */
export function CellLabel({ children }: { children: ReactNode }) {
  return <span className="text-muted-foreground md:hidden">{children} </span>
}
