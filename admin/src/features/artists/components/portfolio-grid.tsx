import type { Photo } from '@/lib/types'
import type { Viewing } from './viewing'

/** Portfolio thumbnails; the first is the cover. Each opens full size. */
export function PortfolioGrid({ photos, onView }: { photos: Photo[]; onView: (image: Viewing) => void }) {
  if (photos.length === 0) return <p className="py-10 text-center text-[13px] text-muted-foreground">No portfolio photos yet.</p>
  return (
    <div className="grid grid-cols-3 gap-3">
      {photos.map((p, i) => (
        <button key={p.id} type="button" onClick={() => onView({ title: 'Portfolio photo', url: p.full_url })} className="group relative overflow-hidden rounded-xl bg-halo" aria-label={`Open photo ${i + 1}`}>
          <img src={p.card_url} alt="" className="aspect-[4/5] w-full object-cover transition-transform group-hover:scale-[1.03]" loading="lazy" />
          {i === 0 && <span className="absolute top-2 left-2 rounded-full bg-white/90 px-2 py-0.5 text-[11px] font-semibold">Cover</span>}
        </button>
      ))}
    </div>
  )
}
