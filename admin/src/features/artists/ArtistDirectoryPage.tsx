import { useSearchParams } from 'react-router'
import { Search } from 'lucide-react'
import { FilterChips } from '@/components/FilterChips'
import { PageHeader } from '@/components/PageHeader'
import { GridHeader } from '@/components/console/grid-header'
import { GridMessage } from '@/components/console/grid-message'
import { GridRow } from '@/components/console/grid-row'
import { InitialsAvatar } from '@/components/console/initials-avatar'
import { KpiTile } from '@/components/console/kpi-tile'
import { Panel } from '@/components/console/panel'
import { PanelFooter } from '@/components/console/panel-footer'
import { PanelToolbar } from '@/components/console/panel-toolbar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { dateTime, monthYear, rupeesShort } from '@/lib/format'
import { artistPath } from '@/lib/paths'
import { useDebouncedValue } from '@/lib/use-debounced-value'
import type { DirectoryRow, DirectoryStatus } from '@/lib/types'
import { useArtistDirectory, useDirectorySummary } from './queries'
import { ARTIST_STATUS } from './status'

const SEARCH_DEBOUNCE_MS = 300
const COLUMNS = '2.2fr 1fr 1fr .8fr 1fr 1fr .8fr'
const number = new Intl.NumberFormat('en-IN')

const FILTERS: { value: DirectoryStatus; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'approved', label: 'Approved' },
  { value: 'pending', label: 'Pending' },
  { value: 'suspended', label: 'Suspended' },
  { value: 'on_hold', label: 'On hold' },
]

const EMPTY: Record<DirectoryStatus, string> = {
  all: 'No artists yet.',
  approved: 'No approved artists yet.',
  pending: 'No artists waiting for review.',
  suspended: 'No suspended artists.',
  on_hold: 'No artists on hold. Everyone has added what\u2019s required.',
}

/** The design's Artists directory: every listed artist with rating and recent booking value. */
export function ArtistDirectoryPage() {
  const [params, setParams] = useSearchParams()
  const status = FILTERS.find((f) => f.value === params.get('status'))?.value ?? 'all'
  const search = params.get('q') ?? ''
  const q = useDebouncedValue(search.trim(), SEARCH_DEBOUNCE_MS)
  const list = useArtistDirectory({ status, q })
  const summary = useDirectorySummary().data
  const rows = list.data?.pages.flatMap((p) => p.items) ?? []
  const chips = FILTERS.map((f) => ({ value: f.value, label: summary ? `${f.label} ${number.format(summary.counts[f.value])}` : f.label }))

  const update = (key: 'status' | 'q', value: string | null) =>
    setParams((prev) => {
      const next = new URLSearchParams(prev)
      if (value) next.set(key, value)
      else next.delete(key)
      return next
    }, { replace: key === 'q' })

  return (
    <>
      <PageHeader title="Artists" subtitle="Every listed artist, newest first." />
      <DirectoryKpis />
      <Panel className="flex flex-col">
        <PanelToolbar>
          <FilterChips chips={chips} value={status} onChange={(next) => update('status', next === 'all' ? null : next)} />
          <span className="flex-1" />
          <label className="flex h-[30px] items-center gap-1.5 rounded-[10px] border border-line px-3 text-xs font-semibold text-muted-foreground focus-within:ring-[3px] focus-within:ring-halo">
            <Search aria-hidden className="size-3.5" />
            <input
              type="search"
              aria-label="Filter artists"
              placeholder="Filter by name"
              value={search}
              onChange={(e) => update('q', e.target.value)}
              className="w-40 bg-transparent text-foreground outline-none placeholder:text-muted-foreground"
            />
          </label>
        </PanelToolbar>
        <GridHeader columns={COLUMNS} labels={['Artist', 'Category', 'City', 'Rating', 'Value · 30d', 'Status', '']} />
        {list.isPending && <GridMessage state="loading" />}
        {list.isError && <GridMessage state="error">Couldn’t load artists. {list.error.message}</GridMessage>}
        {list.isSuccess && rows.length === 0 && <GridMessage state="empty">{q ? `No artists match “${q}”.` : EMPTY[status]}</GridMessage>}
        {rows.map((a) => <DirectoryArtistRow key={a.id} artist={a} />)}
        {list.isSuccess && rows.length > 0 && (
          <PanelFooter
            end={list.hasNextPage && (
              <Button variant="link" size="xs" onClick={() => { void list.fetchNextPage() }} disabled={list.isFetchingNextPage}>
                {list.isFetchingNextPage ? 'Loading…' : 'Load more'}
              </Button>
            )}
          >
            Showing {number.format(rows.length)}{list.hasNextPage ? '+' : ''}
          </PanelFooter>
        )}
      </Panel>
    </>
  )
}

function DirectoryKpis() {
  const s = useDirectorySummary().data
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <KpiTile label="Active artists" value={s && number.format(s.active_artists)} note={s && `▲ ${number.format(s.new_this_month)} this month`} tone="up" />
      <KpiTile label="Avg. rating" value={s && (s.avg_rating?.toFixed(1) ?? '—')} note={s && `Across ${number.format(s.total_reviews)} reviews`} />
      <KpiTile label="Response time" value={s && (s.median_response_minutes === null ? '—' : `${Math.round(s.median_response_minutes)} min`)} note="Median first answer" />
      <KpiTile label="At-risk" value={s && number.format(s.at_risk)} note="Decline or cancel rate > 8%" tone="warn" />
    </div>
  )
}

function DirectoryArtistRow({ artist: a }: { artist: DirectoryRow }) {
  const status = ARTIST_STATUS[a.status]
  const meta = a.status === 'pending'
    ? `Applied ${dateTime(a.created_at)}`
    : `Since ${monthYear(a.created_at)} · ${number.format(a.bookings_total)} ${a.bookings_total === 1 ? 'booking' : 'bookings'}`
  return (
    <GridRow columns={COLUMNS} to={artistPath(a.id)}>
      <div className="flex min-w-0 items-center gap-2.5">
        <InitialsAvatar name={a.business_name} photoUrl={a.photo_url} />
        <div className="min-w-0">
          <div className="truncate font-bold">{a.business_name}</div>
          <div className="truncate text-[11.5px] text-muted-foreground">{meta}</div>
        </div>
      </div>
      <span className="truncate">{a.category ?? '—'}</span>
      <span className="truncate">{a.city}</span>
      <span className="tabular-nums" title={a.rating_count ? `${a.rating_count} reviews` : undefined}>{a.rating_average === null ? '—' : `★ ${a.rating_average.toFixed(1)}`}</span>
      <span className="tabular-nums">{a.booking_value_30d ? rupeesShort(a.booking_value_30d) : '—'}</span>
      <span className="flex flex-wrap items-center gap-1">
        <Badge variant={status.tone}>{status.label}</Badge>
        {a.missing_requirements.length > 0 && <Badge variant="warning">Missing {a.missing_requirements.join(', ')}</Badge>}
      </span>
      <span className="text-right text-[12.5px] font-bold text-primary">{a.status === 'pending' ? 'Review' : 'View'}</span>
    </GridRow>
  )
}
