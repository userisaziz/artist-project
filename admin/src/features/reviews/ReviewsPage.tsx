import { useState } from 'react'
import { useSearchParams } from 'react-router'
import { FilterChips } from '@/components/FilterChips'
import { PageHeader } from '@/components/PageHeader'
import { GridHeader } from '@/components/console/grid-header'
import { GridMessage } from '@/components/console/grid-message'
import { GridRow } from '@/components/console/grid-row'
import { InitialsAvatar } from '@/components/console/initials-avatar'
import { Panel } from '@/components/console/panel'
import { PanelFooter } from '@/components/console/panel-footer'
import { PanelToolbar } from '@/components/console/panel-toolbar'
import { Button } from '@/components/ui/button'
import { monthYear } from '@/lib/format'
import type { AdminReview } from '@/lib/types'
import { useReviews } from './queries'
import { ReviewDetailPanel } from './ReviewDetailPanel'
import { ReviewStatusPill } from './ReviewStatusPill'
import { DEFAULT_REVIEW_STATUS, FLAGS, REVIEW_STATUSES, decisionsFor, excerpt, isReviewStatus, reviewParties } from './status'

const COLUMNS = '2fr 2.6fr .7fr 1fr 1fr .7fr'
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
      <Panel className="flex flex-col">
        <PanelToolbar>
          <FilterChips
            chips={REVIEW_STATUSES}
            value={status}
            onChange={(next) => setParams(next === DEFAULT_REVIEW_STATUS ? {} : { status: next })}
          />
        </PanelToolbar>
        <GridHeader columns={COLUMNS} labels={['Review', 'Excerpt', 'Rating', 'Flag', 'Status', '']} />
        {list.isPending && <GridMessage state="loading" />}
        {list.isError && <GridMessage state="error">Couldn’t load reviews. {list.error.message}</GridMessage>}
        {list.isSuccess && rows.length === 0 && <GridMessage state="empty">{EMPTY[status]}</GridMessage>}
        {rows.map((r) => (
          <GridRow key={r.id} columns={COLUMNS} onClick={() => setSelected(r)} selected={selected?.id === r.id}>
            <div className="flex min-w-0 items-center gap-2.5">
              <InitialsAvatar name={r.reviewer_name} />
              <div className="min-w-0">
                <div className="truncate font-bold">{reviewParties(r)}</div>
                <div className="truncate text-[11.5px] text-muted-foreground">{r.service_name} · {monthYear(r.created_at)}</div>
              </div>
            </div>
            <span className="truncate text-muted-foreground">{excerpt(r.text)}</span>
            <span className="tabular-nums">★ {r.rating}</span>
            <span className="truncate">{r.flag ? FLAGS[r.flag].label : '—'}</span>
            <span><ReviewStatusPill status={r.status} /></span>
            <span className="text-right text-[12.5px] font-bold text-primary max-md:hidden">{decisionsFor(r.status).length > 0 && r.status !== 'published' ? 'Moderate' : 'View'}</span>
          </GridRow>
        ))}
        {list.isSuccess && rows.length > 0 && (
          <PanelFooter
            end={list.hasNextPage && (
              <Button variant="link" size="xs" onClick={() => { void list.fetchNextPage() }} disabled={list.isFetchingNextPage}>
                {list.isFetchingNextPage ? 'Loading…' : 'Load more'}
              </Button>
            )}
          >
            Showing {rows.length}{list.hasNextPage ? '+' : ''}
          </PanelFooter>
        )}
      </Panel>

      <ReviewDetailPanel review={selected} onClose={() => setSelected(null)} onDecided={setSelected} />
    </>
  )
}
