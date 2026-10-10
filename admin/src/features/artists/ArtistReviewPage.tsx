import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { ArrowLeft, Check, X } from 'lucide-react'
import { toast } from 'sonner'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { useCategories } from '@/features/categories/queries'
import { ApiError } from '@/lib/api'
import { dateTime, duration, rupees } from '@/lib/format'
import type { ArtistStatus, Photo } from '@/lib/types'
import { useArtist, useReviewArtist } from './queries'

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
  const [reason, setReason] = useState('')
  const [reasonError, setReasonError] = useState<string | null>(null)
  const [viewing, setViewing] = useState<Photo | null>(null)

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
  const categoryName = new Map(categories.data?.map((c) => [c.id, c.name]))
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

  const submitReject = () => {
    const text = reason.trim()
    if (!text) return setReasonError('Tell the artist what to fix.')
    void decide({ action: 'reject', reason: text })
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
            <Button variant="outline" onClick={() => { setReason(''); setReasonError(null); setRejecting(true) }} disabled={review.isPending}>
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
                        <div className="font-medium">{s.name}</div>
                        {s.description && <div className="text-xs text-muted-foreground">{s.description}</div>}
                      </TableCell>
                      <TableCell>{categoryName.get(s.category_id) ?? '—'}</TableCell>
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
                  <button key={p.id} type="button" onClick={() => setViewing(p)} className="group relative overflow-hidden rounded-lg bg-muted" aria-label={`Open photo ${i + 1}`}>
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

      <Dialog open={rejecting} onOpenChange={setRejecting}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send {a.business_name} back?</DialogTitle>
            <DialogDescription>The artist sees this note in the app and can fix their profile and resubmit.</DialogDescription>
          </DialogHeader>
          <Field data-invalid={!!reasonError}>
            <FieldLabel htmlFor="reject-reason">What needs fixing</FieldLabel>
            <Textarea
              id="reject-reason"
              autoFocus
              rows={4}
              maxLength={500}
              placeholder="e.g. Portfolio photos are blurry — please add clear daylight shots of finished work."
              value={reason}
              aria-invalid={!!reasonError}
              onChange={(e) => { setReason(e.target.value); setReasonError(null) }}
            />
            <FieldError>{reasonError}</FieldError>
          </Field>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejecting(false)}>Cancel</Button>
            <Button variant="destructive" onClick={submitReject} disabled={review.isPending}>{review.isPending ? 'Sending…' : 'Reject'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={viewing !== null} onOpenChange={(open) => !open && setViewing(null)}>
        <DialogContent className="max-w-3xl p-2 sm:max-w-3xl">
          <DialogTitle className="sr-only">Portfolio photo</DialogTitle>
          {viewing && <img src={viewing.full_url} alt="" className="max-h-[80vh] w-full rounded-md object-contain" />}
        </DialogContent>
      </Dialog>
    </>
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
