import { useSearchParams } from 'react-router'
import { Accent } from '@/components/accent'
import { FilterChips } from '@/components/FilterChips'
import { GridHeader } from '@/components/console/grid-header'
import { GridMessage } from '@/components/console/grid-message'
import { GridRow } from '@/components/console/grid-row'
import { InitialsAvatar } from '@/components/console/initials-avatar'
import { Panel } from '@/components/console/panel'
import { PanelFooter } from '@/components/console/panel-footer'
import { PanelToolbar } from '@/components/console/panel-toolbar'
import { PageHeader } from '@/components/PageHeader'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { dateTime } from '@/lib/format'
import { artistPath } from '@/lib/paths'
import type { ArtistSummary, ReviewStatus } from '@/lib/types'
import { useArtistQueue } from './queries'
import { QUEUE_STATUS } from './status'

const TABS: { value: ReviewStatus; label: string; empty: string }[] = [
  { value: 'pending', label: 'Needs review', empty: 'Nothing here — the queue is clear.' },
  { value: 'approved', label: 'Approved', empty: 'No approved artists yet.' },
  { value: 'rejected', label: 'Rejected', empty: 'No rejected artists.' },
]

const COLUMNS = '2fr 1fr 1fr 2fr .8fr 1.1fr 70px'

/** The design's Verification queue: submitted artist profiles, oldest first. */
export function ArtistQueuePage() {
  const [params, setParams] = useSearchParams()
  const status = TABS.find((t) => t.value === params.get('status'))?.value ?? 'pending'
  const queue = useArtistQueue(status)
  const rows = queue.data?.pages.flatMap((p) => p.items) ?? []

  return (
    <>
      <PageHeader
        title={<>Verification <Accent>queue</Accent></>}
        subtitle="Check each artist’s profile, services and portfolio before they go live."
      />
      <Panel className="flex flex-col">
        <PanelToolbar>
          <FilterChips tone="primary" chips={TABS} value={status} onChange={(value) => setParams({ status: value })} />
        </PanelToolbar>
        <GridHeader columns={COLUMNS} labels={['Artist', 'Category', 'City', 'Checks', 'Submitted', 'Status', '']} />
        {queue.isPending && <GridMessage state="loading" />}
        {queue.isError && <GridMessage state="error">Couldn’t load artists. {queue.error.message}</GridMessage>}
        {queue.isSuccess && rows.length === 0 && <GridMessage state="empty">{TABS.find((t) => t.value === status)?.empty}</GridMessage>}
        {rows.map((a) => <QueueRow key={a.id} artist={a} />)}
        {queue.isSuccess && rows.length > 0 && (
          <PanelFooter
            end={queue.hasNextPage && (
              <Button variant="link" size="xs" onClick={() => { void queue.fetchNextPage() }} disabled={queue.isFetchingNextPage}>
                {queue.isFetchingNextPage ? 'Loading…' : 'Load more'}
              </Button>
            )}
          >
            Showing {rows.length}{queue.hasNextPage ? '+' : ''}
          </PanelFooter>
        )}
      </Panel>
    </>
  )
}

function QueueRow({ artist: a }: { artist: ArtistSummary }) {
  const checks = [
    { label: 'Services', n: a.service_count },
    { label: 'Photos', n: a.photo_count },
  ]
  const status = QUEUE_STATUS[a.status]
  return (
    <GridRow columns={COLUMNS} to={artistPath(a.id)}>
      <div className="flex min-w-0 items-center gap-2.5">
        <InitialsAvatar name={a.business_name} photoUrl={a.photo_url} />
        <span className="truncate font-bold">{a.business_name}</span>
        {a.status === 'pending' && a.reviewed_at ? <Badge variant="warning" className="shrink-0">Re-review</Badge> : null}
      </div>
      <span className="truncate">{a.categories.join(', ') || '—'}</span>
      <span className="truncate">{a.city}</span>
      <div className="flex flex-wrap gap-1">
        {checks.map((c) => (
          <Badge key={c.label} variant={c.n > 0 ? 'success' : 'danger'} className="px-[7px] py-0.5 text-[11px]">
            {c.n > 0 ? '✓' : '✕'} {c.label} {c.n}
          </Badge>
        ))}
      </div>
      <span className="text-muted-foreground">{dateTime(a.submitted_at)}</span>
      <span><Badge variant={status.tone}>{status.label}</Badge></span>
      <span className="text-right text-[12.5px] font-bold text-primary">Review</span>
    </GridRow>
  )
}
