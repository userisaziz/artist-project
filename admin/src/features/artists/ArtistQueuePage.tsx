import { useNavigate, useSearchParams } from 'react-router'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PageHeader } from '@/components/PageHeader'
import { dateTime } from '@/lib/format'
import type { ReviewStatus } from '@/lib/types'
import { useArtistQueue } from './queries'

const TABS: { value: ReviewStatus; label: string; empty: string }[] = [
  { value: 'pending', label: 'Pending', empty: 'No artists waiting for review.' },
  { value: 'approved', label: 'Approved', empty: 'No approved artists yet.' },
  { value: 'rejected', label: 'Rejected', empty: 'No rejected artists.' },
]

/** The design's "Verification" queue: submitted artist profiles, oldest first. */
export function ArtistQueuePage() {
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const status = (TABS.find((t) => t.value === params.get('status'))?.value ?? 'pending') as ReviewStatus
  const queue = useArtistQueue(status)
  const rows = queue.data?.pages.flatMap((p) => p.items) ?? []

  return (
    <>
      <PageHeader title="Verification" subtitle="Check each artist’s profile, services and portfolio before they go live." />
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
              <TableHead>City</TableHead>
              <TableHead>Categories</TableHead>
              <TableHead className="text-right">Services</TableHead>
              <TableHead className="text-right">Photos</TableHead>
              <TableHead className="pr-4">Submitted</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {queue.isPending &&
              Array.from({ length: 4 }, (_, i) => (
                <TableRow key={i}><TableCell colSpan={6} className="pl-4"><Skeleton className="h-9 w-full" /></TableCell></TableRow>
              ))}
            {queue.isError && (
              <TableRow><TableCell colSpan={6} className="py-10 text-center text-destructive">Couldn’t load artists. {queue.error.message}</TableCell></TableRow>
            )}
            {queue.isSuccess && rows.length === 0 && (
              <TableRow><TableCell colSpan={6} className="py-12 text-center text-muted-foreground">{TABS.find((t) => t.value === status)?.empty}</TableCell></TableRow>
            )}
            {rows.map((a) => (
              <TableRow key={a.id} className="cursor-pointer" onClick={() => navigate(`/artists/${a.id}`)}>
                <TableCell className="pl-4">
                  <div className="flex items-center gap-3">
                    <Avatar>
                      {a.photo_url && <AvatarImage src={a.photo_url} alt="" />}
                      <AvatarFallback>{a.business_name.slice(0, 1)}</AvatarFallback>
                    </Avatar>
                    <span className="font-medium">{a.business_name}</span>
                  </div>
                </TableCell>
                <TableCell>{a.city}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">{a.categories.map((c) => <Badge key={c} variant="secondary">{c}</Badge>)}</div>
                </TableCell>
                <TableCell className="text-right tabular-nums">{a.service_count}</TableCell>
                <TableCell className="text-right tabular-nums">{a.photo_count}</TableCell>
                <TableCell className="pr-4 text-muted-foreground">{dateTime(a.submitted_at)}</TableCell>
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
    </>
  )
}
