import { useRef, useState } from 'react'
import { Eye } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toastError } from '@/lib/notify'
import type { AdminKyc } from '@/lib/types'
import { revealAadhaar } from '../queries'
import type { Viewing } from './viewing'

/**
 * Spec §3.1. The full number comes from a plain call held in this component's state (never the query or
 * mutation cache), so it disappears when the admin leaves the page. Keyed by artist id by the caller.
 */
export function IdentityPanel({ artistId, kyc, onView, onExpired }: {
  artistId: string
  kyc: AdminKyc | null
  onView: (image: Viewing) => void
  onExpired: () => void
}) {
  const [revealed, setRevealed] = useState<string | null>(null)
  const [revealing, setRevealing] = useState(false)
  const refreshed = useRef(false) // a ref, so front and back failing in the same tick still refetch only once

  const reveal = async () => {
    setRevealing(true)
    try {
      setRevealed((await revealAadhaar(artistId)).aadhaar_number)
    } catch (e) {
      toastError(e)
    } finally {
      setRevealing(false)
    }
  }

  // The card links expire after 5 minutes. On the first broken image, refetch the detail once for fresh links.
  const expired = () => {
    if (refreshed.current) return
    refreshed.current = true
    onExpired()
  }

  if (!kyc) return <p className="py-10 text-center text-[13px] text-muted-foreground">No Aadhaar on file</p>

  return (
    <div className="flex flex-1 flex-col">
      <div className="grid flex-1 grid-cols-2 gap-3">
        {([['Front', kyc.front_url], ['Back', kyc.back_url]] as const).map(([side, url]) => (
          <div key={side} className="flex flex-col gap-1.5">
            <button
              type="button"
              onClick={() => onView({ title: `Aadhaar ${side.toLowerCase()}`, url })}
              className="flex-1 overflow-hidden rounded-xl bg-halo"
              aria-label={`Open Aadhaar ${side.toLowerCase()}`}
            >
              <img src={url} alt={`Aadhaar ${side.toLowerCase()}`} onError={expired} className="aspect-[3/2] size-full object-cover" />
            </button>
            <span className="text-[11.5px] text-muted-foreground">Aadhaar {side.toLowerCase()}</span>
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-3 border-t border-line-soft pt-3">
        <span className="text-[15px] font-semibold tracking-wide tabular-nums">
          {revealed ? revealed.replace(/(\d{4})(?=\d)/g, '$1 ') : kyc.aadhaar_masked}
        </span>
        {!revealed && (
          <Button variant="outline" size="sm" onClick={() => { void reveal() }} disabled={revealing}>
            <Eye /> {revealing ? 'Revealing…' : 'Reveal'}
          </Button>
        )}
        <span className="ml-auto text-[11.5px] text-muted-foreground">Reveals are logged.</span>
      </div>
    </div>
  )
}
