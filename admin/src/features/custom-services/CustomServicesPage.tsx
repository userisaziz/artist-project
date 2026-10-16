import { useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { Check, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PageHeader } from '@/components/PageHeader'
import { RejectReasonDialog } from '@/components/RejectReasonDialog'
import { ApiError } from '@/lib/api'
import { dateTime, duration, rupees } from '@/lib/format'
import type { CustomServiceItem, ReviewStatus } from '@/lib/types'
import { useCustomServiceQueue, useDecideCustomService } from './queries'

const TABS: { value: ReviewStatus; label: string; empty: string }[] = [
  { value: 'pending', label: 'Pending', empty: 'No custom services waiting for review.' },
  { value: 'approved', label: 'Approved', empty: 'No approved custom services yet.' },
  { value: 'rejected', label: 'Rejected', empty: 'No rejected custom services.' },
]

/** Services approved artists propose outside the admin's list; each one is approved or rejected on its own. Oldest first. */
export function CustomServicesPage() {
  const [params, setParams] = useSearchParams()
  const status = (TABS.find((t) => t.value === params.get('status'))?.value ?? 'pending') as ReviewStatus
  const queue = useCustomServiceQueue(status)
  const decide = useDecideCustomService()
  const [rejecting, setRejecting] = useState<CustomServiceItem | null>(null)
  const rows = queue.data?.pages.flatMap((p) => p.items) ?? []
  const columns = status === 'pending' ? 7 : 6

  const run = async (item: CustomServiceItem, decision: { action: 'approve' } | { action: 'reject'; reason: string }) => {
    try {
      await decide.mutateAsync({ id: item.id, decision })
      toast.success(decision.action === 'approve' ? `“${item.name}” is approved and bookable` : `“${item.name}” was sent back with your note`)
      setRejecting(null)
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Something went wrong. Please try again.')
    }
  }

  return (
    <>
      <PageHeader title="Custom services" subtitle="Services approved artists add outside your catalog. Check each one before clients can book it." />
      <Tabs value={status} onValueChange={(value) => setParams({ status: String(value) })} className="mb-4">
        <TabsList>
          {TABS.map((t) => <TabsTrigger key={t.value} value={t.value}>{t.label}</TabsTrigger>)}
        </TabsList>
      </Tabs>

      <div className="rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4">Artist</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Service</TableHead>
              <TableHead className="text-right">Price</TableHead>
              <TableHead>Duration</TableHead>
              <TableHead className={status === 'pending' ? undefined : 'pr-4'}>Submitted</TableHead>
              {status === 'pending' && <TableHead className="w-48 pr-4" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {queue.isPending &&
              Array.from({ length: 4 }, (_, i) => (
                <TableRow key={i}><TableCell colSpan={columns} className="pl-4"><Skeleton className="h-9 w-full" /></TableCell></TableRow>
              ))}
            {queue.isError && (
              <TableRow><TableCell colSpan={columns} className="py-10 text-center text-destructive">Couldn’t load custom services. {queue.error.message}</TableCell></TableRow>
            )}
            {queue.isSuccess && rows.length === 0 && (
              <TableRow><TableCell colSpan={columns} className="py-12 text-center text-muted-foreground">{TABS.find((t) => t.value === status)?.empty}</TableCell></TableRow>
            )}
            {rows.map((s) => (
              <TableRow key={s.id}>
                <TableCell className="pl-4 font-medium">
                  <Link to={`/artists/${s.artist_id}`} className="hover:underline">{s.business_name}</Link>
                </TableCell>
                {/* Older rows point straight at a top-level category, so there's no parent to show. */}
                <TableCell>{s.category ? `${s.category.name} › ${s.subcategory.name}` : s.subcategory.name}</TableCell>
                <TableCell className="whitespace-normal">
                  <div className="font-medium">{s.name}</div>
                  {s.description && <div className="text-xs text-muted-foreground">{s.description}</div>}
                  {s.rejection_reason && <div className="text-xs text-[#A33A3A]">Sent back: {s.rejection_reason}</div>}
                </TableCell>
                <TableCell className="text-right font-medium tabular-nums">{rupees(s.price_paise)}</TableCell>
                <TableCell>{duration(s.duration_minutes)}</TableCell>
                <TableCell className={status === 'pending' ? 'text-muted-foreground' : 'pr-4 text-muted-foreground'}>{dateTime(s.created_at)}</TableCell>
                {status === 'pending' && (
                  <TableCell className="pr-4 text-right whitespace-nowrap">
                    <Button variant="outline" size="sm" className="mr-2" aria-label={`Reject ${s.name}`} onClick={() => setRejecting(s)} disabled={decide.isPending}>
                      <X /> Reject
                    </Button>
                    <Button size="sm" aria-label={`Approve ${s.name}`} onClick={() => { void run(s, { action: 'approve' }) }} disabled={decide.isPending}>
                      <Check /> Approve
                    </Button>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {queue.hasNextPage && (
        <div className="mt-4 flex justify-center">
          <Button variant="outline" onClick={() => { void queue.fetchNextPage() }} disabled={queue.isFetchingNextPage}>
            {queue.isFetchingNextPage ? 'Loading…' : 'Load more'}
          </Button>
        </div>
      )}

      <RejectReasonDialog
        open={rejecting !== null}
        title={`Reject “${rejecting?.name ?? ''}”?`}
        description={`${rejecting?.business_name ?? 'The artist'} sees this note in the app and can edit the service to send it again.`}
        placeholder="e.g. This is already in the catalog as Bridal Classic — please add it from the list instead."
        pending={decide.isPending}
        onClose={() => setRejecting(null)}
        onSubmit={(reason) => { if (rejecting) void run(rejecting, { action: 'reject', reason }) }}
      />
    </>
  )
}
