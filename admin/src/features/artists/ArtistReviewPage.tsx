import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { toast } from 'sonner'
import { InitialsAvatar } from '@/components/console/initials-avatar'
import { Panel } from '@/components/console/panel'
import { RejectReasonDialog } from '@/components/RejectReasonDialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useCategories } from '@/features/categories/queries'
import { ApiError } from '@/lib/api'
import { dateTime } from '@/lib/format'
import { toastError } from '@/lib/notify'
import { PATHS } from '@/lib/paths'
import type { AdminCategory, ArtistDetail } from '@/lib/types'
import { IdentityPanel } from './components/identity-panel'
import { KycChecklist } from './components/kyc-checklist'
import { PortfolioGrid } from './components/portfolio-grid'
import { RequirementsCard } from './components/requirements-card'
import { ServicesList } from './components/services-list'
import type { Viewing } from './components/viewing'
import { useArtist, useReviewArtist, useSuspension } from './queries'
import { ARTIST_STATUS } from './status'

/** The design's KYC review: checklist, the evidence in tabs, and the decision column. */
export function ArtistReviewPage() {
  const { id = '' } = useParams()
  const artist = useArtist(id)
  const categories = useCategories()
  const review = useReviewArtist(id)
  const suspension = useSuspension(id)
  const [rejecting, setRejecting] = useState(false)
  const [suspending, setSuspending] = useState(false)
  const [viewing, setViewing] = useState<Viewing | null>(null)

  if (artist.isPending) return <Skeleton className="h-96 w-full rounded-2xl" />
  if (artist.isError) {
    return (
      <div className="py-20 text-center">
        <p className="font-medium">{artist.error instanceof ApiError && artist.error.code === 'not_found' ? 'Artist not found' : 'Couldn’t load this artist'}</p>
        <Button variant="link" render={<Link to={PATHS.artists} />}>Back to Verification</Button>
      </div>
    )
  }

  const a = artist.data
  const byId = new Map(categories.data?.map((c) => [c.id, c]))
  // "Makeup › Bridal"; rows from before subcategories point straight at a top-level category.
  const placeOf = (subId: number) => {
    const c: AdminCategory | undefined = byId.get(subId)
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
      toastError(e)
    }
  }

  const changeSuspension = async (change: { action: 'suspend'; reason: string } | { action: 'reinstate' }) => {
    try {
      await suspension.mutateAsync(change)
      toast.success(change.action === 'suspend' ? `${a.business_name} is suspended` : `${a.business_name} is reinstated and live again`)
      setSuspending(false)
    } catch (e) {
      toastError(e)
    }
  }

  return (
    <div className="flex flex-col">
      <nav aria-label="Breadcrumb" className="text-[12.5px] text-muted-foreground">
        <Link to={PATHS.artists} className="font-semibold text-primary hover:text-primary-hover">Verification</Link> › {a.business_name}
      </nav>

      <div className="mt-3 flex items-center gap-3.5">
        <InitialsAvatar name={a.business_name} photoUrl={a.photo_url} size={64} />
        <div className="min-w-0 flex-1">
          <h1 className="text-[23.4px] leading-none font-semibold tracking-[-0.025em]">{a.business_name}</h1>
          <p className="mt-1 text-[12.5px] text-muted-foreground">
            {[owner, a.categories.map((c) => c.name).join(', '), a.city, `Submitted ${dateTime(a.submitted_at)}`].filter(Boolean).join(' · ')}
          </p>
        </div>
        <Badge variant={ARTIST_STATUS[a.status].tone} className="px-3 py-[5px] text-xs">{ARTIST_STATUS[a.status].label}</Badge>
      </div>

      {a.status === 'suspended' && (
        <div className="mt-4 rounded-xl bg-danger-soft p-3.5 text-[13px] text-destructive">
          <span className="font-semibold">Suspended:</span> hidden from clients and can’t take new bookings until reinstated.
        </div>
      )}

      {a.status === 'rejected' && a.rejection_reason && (
        <div className="mt-4 rounded-xl bg-danger-soft p-3.5 text-[13px] text-destructive">
          <span className="font-semibold">Sent back:</span> {a.rejection_reason}
        </div>
      )}

      <div className="mt-4 grid gap-3.5 lg:grid-cols-[250px_1fr_280px]">
        <KycChecklist artist={a} />

        <Panel className="p-3.5">
          <Tabs defaultValue="identity">
            <TabsList variant="segment" aria-label="Evidence">
              <TabsTrigger value="identity">Aadhaar</TabsTrigger>
              <TabsTrigger value="portfolio">Portfolio ({a.photos.length})</TabsTrigger>
              <TabsTrigger value="services">Services ({a.services.length})</TabsTrigger>
            </TabsList>
            <TabsContent value="identity" className="mt-3 flex">
              <IdentityPanel key={a.id} artistId={a.id} kyc={a.kyc} onView={setViewing} onExpired={() => { void artist.refetch() }} />
            </TabsContent>
            <TabsContent value="portfolio" className="mt-3"><PortfolioGrid photos={a.photos} onView={setViewing} /></TabsContent>
            <TabsContent value="services" className="mt-3"><ServicesList services={a.services} placeOf={placeOf} /></TabsContent>
          </Tabs>
        </Panel>

        <DecisionColumn
          artist={a}
          owner={owner}
          pending={review.isPending || suspension.isPending}
          onApprove={() => { void decide({ action: 'approve' }) }}
          onReject={() => setRejecting(true)}
          onSuspend={() => setSuspending(true)}
          onReinstate={() => { void changeSuspension({ action: 'reinstate' }) }}
        />
      </div>
      {(a.status === 'approved' || a.status === 'suspended') && <RequirementsCard artistId={a.id} name={a.business_name} />}

      <RejectReasonDialog
        open={rejecting}
        title={`Send ${a.business_name} back?`}
        description="The artist sees this note in the app and can fix their profile and resubmit."
        placeholder="e.g. Portfolio photos are blurry — please add clear daylight shots of finished work."
        pending={review.isPending}
        onClose={() => setRejecting(false)}
        onSubmit={(reason) => { void decide({ action: 'reject', reason }) }}
      />

      <RejectReasonDialog
        open={suspending}
        title={`Suspend ${a.business_name}?`}
        description="Their profile is hidden and they can’t take new bookings until reinstated. Existing bookings stay as they are."
        placeholder="e.g. Three customers reported no-shows this month."
        label="Reason"
        submitLabel="Suspend"
        dismissLabel="Keep live"
        requiredMessage="Add a reason for suspending."
        pending={suspension.isPending}
        onClose={() => setSuspending(false)}
        onSubmit={(reason) => { void changeSuspension({ action: 'suspend', reason }) }}
      />

      <Dialog open={viewing !== null} onOpenChange={(open) => !open && setViewing(null)}>
        <DialogContent className="max-w-3xl p-2 sm:max-w-3xl">
          <DialogTitle className="sr-only">{viewing?.title}</DialogTitle>
          {viewing && <img src={viewing.url} alt="" className="max-h-[80vh] w-full rounded-md object-contain" />}
        </DialogContent>
      </Dialog>
    </div>
  )
}

interface DecisionColumnProps {
  artist: ArtistDetail
  owner: string
  pending: boolean
  onApprove: () => void
  onReject: () => void
  onSuspend: () => void
  onReinstate: () => void
}

function DecisionColumn({ artist: a, owner, pending, onApprove, onReject, onSuspend, onReinstate }: DecisionColumnProps) {
  const details = [
    ['Name', owner],
    ['Phone', a.owner.phone],
    ['Email', a.owner.email ?? '—'],
    ['Reviewed', dateTime(a.reviewed_at)],
  ] as const
  return (
    <Panel className="flex flex-col gap-2.5 p-3.5">
      <h2 className="text-[13px] font-bold">Account</h2>
      <dl className="space-y-2 text-[12.5px]">
        {details.map(([label, value]) => (
          <div key={label} className="flex justify-between gap-4">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="text-right font-semibold">{value}</dd>
          </div>
        ))}
      </dl>
      {a.bio && (
        <div className="rounded-xl bg-row-hover p-2.5 text-[12.5px] leading-normal whitespace-pre-line">
          <b>About</b><br />{a.bio}
        </div>
      )}
      <div className="flex-1" />
      {a.status === 'pending' && (
        <>
          <Button className="h-11 rounded-xl text-sm font-semibold" onClick={onApprove} disabled={pending}>
            {pending ? 'Saving…' : 'Approve & publish'}
          </Button>
          <Button variant="outline" className="h-10 rounded-xl text-[13px] font-semibold text-destructive" onClick={onReject} disabled={pending}>
            Reject
          </Button>
        </>
      )}
      {a.status === 'approved' && (
        <Button variant="outline" className="h-10 rounded-xl text-[13px] font-semibold text-destructive" onClick={onSuspend} disabled={pending}>
          Suspend artist
        </Button>
      )}
      {a.status === 'suspended' && (
        <Button className="h-11 rounded-xl text-sm font-semibold" onClick={onReinstate} disabled={pending}>
          {pending ? 'Saving…' : 'Reinstate'}
        </Button>
      )}
    </Panel>
  )
}
