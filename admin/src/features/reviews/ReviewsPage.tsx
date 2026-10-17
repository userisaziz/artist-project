import { useState } from 'react'
import { useSearchParams } from 'react-router'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { FilterChips } from '@/components/FilterChips'
import { PageHeader } from '@/components/PageHeader'
import { monthYear } from '@/lib/format'
import type { AdminReview } from '@/lib/types'
import { useReviews } from './queries'
import { ReviewDetailPanel } from './ReviewDetailPanel'
import { ReviewStatusPill } from './ReviewStatusPill'
import { DEFAULT_REVIEW_STATUS, FLAGS, REVIEW_STATUSES, excerpt, isReviewStatus, reviewParties } from './status'

const COLUMNS = 5
const EMPTY: Record<AdminReview['status'], string> = {
  flagged: 'No flagged reviews. Nothing is waiting for a moderator.',
  hidden: 'No hidden reviews.',
  published: 'No published reviews yet.',
  removed: 'No removed reviews.',
}

/** The moderation queue: reviews the auto-filter hid or artists reported, plus every other status to look back on. */
export function ReviewsPage() {
  const [params, setParams] = useSearchParams()
  const raw = params.get('status')
  const status = isReviewStatus(raw) ? raw : DEFAULT_REVIEW_STATUS
  const list = useReviews(status)
  const rows = list.data?.pages.flatMap((p) => p.items) ?? []
  // The panel keeps its own copy, so it shows the decided review even after it leaves this status.
  const [selected, setSelected] = useState<AdminReview | null>(null)

  return (
    <>
      <PageHeader title="Reviews" subtitle="Moderate reviews reported by artists or caught by the filters." />
      <div className="mb-4">
        <FilterChips
          chips={REVIEW_STATUSES}
          value={status}
          onChange={(next) => setParams(next === DEFAULT_REVIEW_STATUS ? {} : { status: next })}
        />
      </div>

      <div className="rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4">Review</TableHead>
              <TableHead>Excerpt</TableHead>
              <TableHead>Rating</TableHead>
              <TableHead>Flag</TableHead>
              <TableHead className="pr-4">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.isPending &&
              Array.from({ length: 4 }, (_, i) => (
                <TableRow key={i}><TableCell colSpan={COLUMNS} className="pl-4"><Skeleton className="h-9 w-full" /></TableCell></TableRow>
              ))}
            {list.isError && (
              <TableRow><TableCell colSpan={COLUMNS} className="py-10 text-center text-destructive">Couldn’t load reviews. {list.error.message}</TableCell></TableRow>
            )}
            {list.isSuccess && rows.length === 0 && (
              <TableRow><TableCell colSpan={COLUMNS} className="py-12 text-center text-muted-foreground">{EMPTY[status]}</TableCell></TableRow>
            )}
            {rows.map((r) => (
              <TableRow key={r.id} className="cursor-pointer" onClick={() => setSelected(r)}>
                <TableCell className="pl-4">
                  <button type="button" className="text-left font-medium hover:underline" onClick={(e) => { e.stopPropagation(); setSelected(r) }}>
                    {reviewParties(r)}
                  </button>
                  <div className="text-xs text-muted-foreground">{r.service_name} · {monthYear(r.created_at)}</div>
                </TableCell>
                <TableCell className="max-w-sm whitespace-normal text-muted-foreground">{excerpt(r.text)}</TableCell>
                <TableCell className="font-medium whitespace-nowrap tabular-nums">★ {r.rating}</TableCell>
                <TableCell>{r.flag ? FLAGS[r.flag].label : '—'}</TableCell>
                <TableCell className="pr-4"><ReviewStatusPill status={r.status} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {list.hasNextPage && (
        <div className="mt-4 flex justify-center">
          <Button variant="outline" onClick={() => { void list.fetchNextPage() }} disabled={list.isFetchingNextPage}>
            {list.isFetchingNextPage ? 'Loading…' : 'Load more'}
          </Button>
        </div>
      )}

      <ReviewDetailPanel review={selected} onClose={() => setSelected(null)} onDecided={setSelected} />
    </>
  )
}
