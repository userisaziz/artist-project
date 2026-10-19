import { KpiTile } from '@/components/console/kpi-tile'
import type { AdminCategory } from '@/lib/types'

const number = new Intl.NumberFormat('en-IN')
const sum = (list: AdminCategory[], pick: (c: AdminCategory) => number) => list.reduce((n, c) => n + pick(c), 0)

/** The KPI strip over the Catalog, worked out from the category list itself. */
export function CatalogKpis({ categories }: { categories: AdminCategory[] | undefined }) {
  const all = categories ?? []
  const topLevel = all.filter((c) => c.parent_id === null)
  const subs = all.length - topLevel.length
  const top = topLevel.reduce<AdminCategory | null>((best, c) => (best && best.artist_count >= c.artist_count ? best : c), null)
  const ready = categories !== undefined
  const value = (n: number) => (ready ? number.format(n) : undefined)

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <KpiTile label="Categories" value={value(topLevel.length)} note={ready ? `+ ${number.format(subs)} subcategories` : undefined} />
      <KpiTile label="Service listings" value={value(sum(all, (c) => c.service_count))} note="Offered by artists" />
      <KpiTile label="Catalogue services" value={value(sum(all, (c) => c.template_count))} note="Artists pick from these" />
      <KpiTile
        label="Top category"
        value={ready ? (top && top.artist_count > 0 ? top.name : '—') : undefined}
        note={top && top.artist_count > 0 ? `${number.format(top.artist_count)} artists` : undefined}
        tone="up"
      />
    </div>
  )
}
