import type { ReactNode } from 'react'

/** Uppercase column labels on the pink header strip; `columns` is the CSS grid template shared with GridRow. Phones show rows as cards, so no header. */
export function GridHeader({ columns, labels }: { columns: string; labels: ReactNode[] }) {
  return (
    <div
     
      className="hidden items-center gap-3 bg-halo md:grid px-4 py-2.5 text-[11px] font-bold tracking-[0.06em] text-muted-foreground uppercase"
      style={{ gridTemplateColumns: columns }}
    >
      {labels.map((label, i) => <span key={i}>{label}</span>)}
    </div>
  )
}
