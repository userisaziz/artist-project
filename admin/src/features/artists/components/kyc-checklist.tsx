import { Panel } from '@/components/console/panel'
import type { ArtistDetail } from '@/lib/types'
import { cn } from '@/lib/utils'

/** What the reviewer checks before approving, ticked from what the artist has actually submitted. */
export function KycChecklist({ artist: a }: { artist: ArtistDetail }) {
  const items = [
    { label: 'Phone verified', done: true }, // sign-in is by SMS code, so every owner has one
    { label: 'Aadhaar on file', done: a.kyc !== null },
    { label: 'Profile photo', done: a.photo_url !== null },
    { label: 'Services added', done: a.services.length > 0 },
    { label: 'Portfolio photos', done: a.photos.length > 0 },
    { label: 'About written', done: Boolean(a.bio?.trim()) },
  ]
  return (
    <Panel className="flex flex-col gap-0.5 p-3.5">
      <h2 className="mb-1.5 text-[13px] font-bold">KYC checklist</h2>
      <ul>
        {items.map((item) => (
          <li key={item.label} className="flex gap-2.5 border-b border-line-soft py-[9px] text-[13px] last:border-b-0">
            <span aria-hidden className={cn(item.done ? 'text-success' : 'text-faint')}>{item.done ? '✓' : '○'}</span>
            <span className="flex-1">{item.label}</span>
            <span className="sr-only">{item.done ? 'done' : 'missing'}</span>
          </li>
        ))}
      </ul>
    </Panel>
  )
}
