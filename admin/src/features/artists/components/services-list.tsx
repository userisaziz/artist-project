import { Badge } from '@/components/ui/badge'
import { duration, rupees } from '@/lib/format'
import type { Service, ServiceStatus } from '@/lib/types'

const SERVICE_STATUS: Record<Exclude<ServiceStatus, 'approved'>, { label: string; tone: 'warning' | 'danger' }> = {
  pending: { label: 'Pending review', tone: 'warning' },
  rejected: { label: 'Rejected', tone: 'danger' },
}

/** The artist's services with where each sits in the catalog; custom and not-yet-approved ones are marked. */
export function ServicesList({ services, placeOf }: { services: Service[]; placeOf: (subcategoryId: number) => string }) {
  if (services.length === 0) return <p className="py-10 text-center text-[13px] text-muted-foreground">No services yet.</p>
  return (
    <table className="w-full text-[13px]">
      <thead>
        <tr className="bg-halo text-left text-[11px] font-bold tracking-[0.06em] text-muted-foreground uppercase">
          <th className="rounded-l-lg px-3 py-2.5 font-bold">Service</th>
          <th className="px-3 py-2.5 font-bold">Category</th>
          <th className="px-3 py-2.5 font-bold">Duration</th>
          <th className="rounded-r-lg px-3 py-2.5 text-right font-bold">Price</th>
        </tr>
      </thead>
      <tbody>
        {services.map((s) => (
          <tr key={s.id} className="border-b border-line-soft last:border-b-0">
            <td className="px-3 py-[11px]">
              <div className="flex flex-wrap items-center gap-1.5 font-bold">
                {s.name}
                {s.template_id === null && <Badge variant="neutral">Custom</Badge>}
                {s.status !== 'approved' && <Badge variant={SERVICE_STATUS[s.status].tone}>{SERVICE_STATUS[s.status].label}</Badge>}
              </div>
              {s.description && <div className="text-[11.5px] text-muted-foreground">{s.description}</div>}
            </td>
            <td className="px-3 py-[11px]">{placeOf(s.subcategory_id)}</td>
            <td className="px-3 py-[11px]">{duration(s.duration_minutes)}</td>
            <td className="px-3 py-[11px] text-right font-semibold tabular-nums">{rupees(s.price_paise)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
