import { useRef, useState } from 'react'
import { Link, useParams } from 'react-router'
import { ArrowLeft, Check, Eye, X } from 'lucide-react'
import { toast } from 'sonner'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { RejectReasonDialog } from '@/components/RejectReasonDialog'
import { useCategories } from '@/features/categories/queries'
import { ApiError } from '@/lib/api'
import { dateTime, duration, rupees } from '@/lib/format'
import type { AdminCategory, AdminKyc, ArtistStatus, ServiceStatus } from '@/lib/types'
import { revealAadhaar, useArtist, useReviewArtist } from './queries'

/** What the full-size image dialog shows: a portfolio photo or one side of the Aadhaar card. */
type Viewing = { title: string; url: string }

const SERVICE_STATUS: Record<Exclude<ServiceStatus, 'approved'>, { label: string; className: string }> = {
  pending: { label: 'Pending review', className: 'bg-[#FDF0DC] text-[#9A6514]' },
  rejected: { label: 'Rejected', className: 'bg-[#FBE3E3] text-[#A33A3A]' },
}

const STATUS: Record<ArtistStatus, { label: string; className: string }> = {
  draft: { label: 'Draft', className: 'bg-muted text-muted-foreground' },
  pending: { label: 'Pending review', className: 'bg-[#FDF0DC] text-[#9A6514]' },
  approved: { label: 'Approved', className: 'bg-[#E3F1E7] text-[#2F6B47]' },
  rejected: { label: 'Rejected', className: 'bg-[#FBE3E3] text-[#A33A3A]' },
}

export function ArtistReviewPage() {
  const { id = '' } = useParams()
  const artist = useArtist(id)
  const categories = useCategories()
  const review = useReviewArtist(id)
  const [rejecting, setRejecting] = useState(false)
  const [viewing, setViewing] = useState<Viewing | null>(null)

  if (artist.isPending) return <Skeleton className="h-96 w-full rounded-xl" />
  if (artist.isError) {
    return (
      <div className="py-20 text-center">
        <p className="font-medium">{artist.error instanceof ApiError && artist.error.code === 'not_found' ? 'Artist not found' : 'Couldn’t load this artist'}</p>
        <Button variant="link" render={<Link to="/artists" />}>Back to Verification</Button>
      </div>
    )
  }

  const a = artist.data
  const byId = new Map(categories.data?.map((c) => [c.id, c]))
  // "Makeup › Bridal"; rows from before subcategories point straight at a top-level category.
  const placeOf = (id: number) => {
    const c: AdminCategory | undefined = byId.get(id)
    const parent = c?.parent_id != null ? byId.get(c.parent_id) : undefined
    return c ? (parent ? `${parent.name} › ${c.name}` : c.name) : '—'
  }
  const owner = [a.owner.first_name, a.owner.last_name].filter(Boolean).join(' ') || 'No name yet'

  const decide = async (decision: { action: 'approve' } | { action: 'reject'; reason: string }) => {
    try {
      await review.mutateAsync(decision)
      toast.success(decision.action === 'approve' ? `${a.business_name} is approved and live` : `${a.business_name} was sent back with your note`)
      setRejecting(false)
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Something went wrong. Please try again.')
    }
  }

  return (
    <>
      <Link to="/artists" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Verification
      </Link>

      <div className="mb-6 flex flex-wrap items-center gap-4">
        <Avatar className="size-16">
          {a.photo_url && <AvatarImage src={a.photo_url} alt="" />}
          <AvatarFallback className="text-xl">{a.business_name.slice(0, 1)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{a.business_name}</h1>
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS[a.status].className}`}>{STATUS[a.status].label}</span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{a.city} · submitted {dateTime(a.submitted_at)}</p>
        </div>
        {a.status === 'pending' && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setRejecting(true)} disabled={review.isPending}>
              <X /> Reject
            </Button>
            <Button onClick={() => { void decide({ action: 'approve' }) }} disabled={review.isPending}>
              <Check /> {review.isPending ? 'Saving…' : 'Approve'}
            </Button>
          </div>
        )}
      </div>

      {a.status === 'rejected' && a.rejection_reason && (
        <div className="mb-6 rounded-xl border border-[#F3C9C9] bg-[#FBE3E3] p-4 text-sm text-[#A33A3A]">
          <span className="font-semibold">Sent back:</span> {a.rejection_reason}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <IdentityCard key={a.id} artistId={a.id} kyc={a.kyc} onView={setViewing} onExpired={() => { void artist.refetch() }} />

          <Card>
            <CardHeader><CardTitle>Services · {a.services.length}</CardTitle></CardHeader>
            <CardContent className="px-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-6">Service</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead className="pr-6 text-right">Price</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {a.services.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="pl-6">
                        <div className="flex flex-wrap items-center gap-1.5 font-medium">
                          {s.name}
                          {s.template_id === null && <Badge variant="outline">Custom</Badge>}
                          {s.status !== 'approved' && (
                            <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${SERVICE_STATUS[s.status].className}`}>{SERVICE_STATUS[s.status].label}</span>
                          )}
                        </div>
                        {s.description && <div className="text-xs text-muted-foreground">{s.description}</div>}
                      </TableCell>
                      <TableCell>{placeOf(s.subcategory_id)}</TableCell>
                      <TableCell>{duration(s.duration_minutes)}</TableCell>
                      <TableCell className="pr-6 text-right font-medium tabular-nums">{rupees(s.price_paise)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Portfolio · {a.photos.length}</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {a.photos.map((p, i) => (
                  <button key={p.id} type="button" onClick={() => setViewing({ title: 'Portfolio photo', url: p.full_url })} className="group relative overflow-hidden rounded-lg bg-muted" aria-label={`Open photo ${i + 1}`}>
                    <img src={p.card_url} alt="" className="aspect-[4/5] w-full object-cover transition-transform group-hover:scale-[1.03]" loading="lazy" />
                    {i === 0 && <span className="absolute top-2 left-2 rounded-full bg-white/90 px-2 py-0.5 text-[11px] font-semibold">Cover</span>}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Account</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <Row label="Name" value={owner} />
              <Row label="Phone" value={a.owner.phone} />
              <Row label="Email" value={a.owner.email ?? '—'} />
              <Row label="Reviewed" value={dateTime(a.reviewed_at)} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Offers</CardTitle></CardHeader>
            <CardContent className="flex flex-wrap gap-1.5">
              {a.categories.map((c) => <Badge key={c.id} variant="secondary">{c.name}</Badge>)}
            </CardContent>
          </Card>
          {a.bio && (
            <Card>
              <CardHeader><CardTitle>About</CardTitle></CardHeader>
              <CardContent className="text-sm whitespace-pre-line">{a.bio}</CardContent>
            </Card>
          )}
        </div>
      </div>

      <RejectReasonDialog
        open={rejecting}
        title={`Send ${a.business_name} back?`}
        description="The artist sees this note in the app and can fix their profile and resubmit."
        placeholder="e.g. Portfolio photos are blurry — please add clear daylight shots of finished work."
        pending={review.isPending}
        onClose={() => setRejecting(false)}
        onSubmit={(reason) => { void decide({ action: 'reject', reason }) }}
      />

      <Dialog open={viewing !== null} onOpenChange={(open) => !open && setViewing(null)}>
        <DialogContent className="max-w-3xl p-2 sm:max-w-3xl">
          <DialogTitle className="sr-only">{viewing?.title}</DialogTitle>
          {viewing && <img src={viewing.url} alt="" className="max-h-[80vh] w-full rounded-md object-contain" />}
        </DialogContent>
      </Dialog>
    </>
  )
}

/**
 * Spec §3.1. The full number comes from a plain call held in this component's state (never the query or
 * mutation cache), so it disappears when the admin leaves the page. Keyed by artist id by the caller.
 */
function IdentityCard({ artistId, kyc, onView, onExpired }: {
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
      toast.error(e instanceof ApiError ? e.message : 'Something went wrong. Please try again.')
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

  return (
    <Card>
      <CardHeader><CardTitle>Identity (Aadhaar)</CardTitle></CardHeader>
      <CardContent>
        {!kyc ? (
          <p className="text-sm text-muted-foreground">No Aadhaar on file</p>
        ) : (
          <div className="space-y-4">
            <div>
              <div className="flex items-center gap-3">
                <span className="text-lg font-semibold tracking-wide tabular-nums">
                  {revealed ? revealed.replace(/(\d{4})(?=\d)/g, '$1 ') : kyc.aadhaar_masked}
                </span>
                {!revealed && (
                  <Button variant="outline" size="sm" onClick={() => { void reveal() }} disabled={revealing}>
                    <Eye /> {revealing ? 'Revealing…' : 'Reveal'}
                  </Button>
                )}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">Reveals are logged.</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {([['Front', kyc.front_url], ['Back', kyc.back_url]] as const).map(([side, url]) => (
                <button
                  key={side}
                  type="button"
                  onClick={() => onView({ title: `Aadhaar ${side.toLowerCase()}`, url })}
                  className="overflow-hidden rounded-lg bg-muted text-left"
                  aria-label={`Open Aadhaar ${side.toLowerCase()}`}
                >
                  <img src={url} alt={`Aadhaar ${side.toLowerCase()}`} onError={expired} className="aspect-[3/2] w-full object-cover" />
                  <span className="block px-2 py-1 text-xs font-medium text-muted-foreground">{side}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  )
}
