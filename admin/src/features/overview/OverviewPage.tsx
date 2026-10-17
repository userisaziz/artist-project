import { useState } from 'react'
import { Link } from 'react-router'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useArtistQueue } from '@/features/artists/queries'
import { useAuth } from '@/lib/auth'
import { dateTime, rupees, rupeesShort } from '@/lib/format'
import type { AdminOverview } from '@/lib/types'
import { useOverview } from './queries'
import { WeeklyBookingsChart } from './WeeklyBookingsChart'

const QUEUE_PREVIEW = 5
const count = new Intl.NumberFormat('en-IN')

function greeting(hour: number) {
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

/** The console's landing page: the last 30 days at a glance and who is waiting for review. */
export function OverviewPage() {
  const { user } = useAuth()
  const overview = useOverview()
  const o = overview.data
  const [hour] = useState(() => new Date().getHours()) // fixed for the visit, so re-renders don't flip the greeting

  return (
    <>
      <div className="mb-6">
        <h1 className="text-3xl font-semibold tracking-tight">
          {greeting(hour)}, <span className="text-primary italic">{user?.first_name ?? 'there'}</span>
        </h1>
        {o && (
          <p className="mt-1 text-sm text-muted-foreground">
            {o.pending_artists} {o.pending_artists === 1 ? 'artist is' : 'artists are'} waiting for verification and {o.awaiting_artist} {o.awaiting_artist === 1 ? 'request is' : 'requests are'} waiting for an artist.
          </p>
        )}
      </div>

      {overview.isError && <p className="mb-6 text-sm text-destructive">Couldn’t load the overview. {overview.error.message}</p>}
      <Kpis overview={o} />

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader><CardTitle className="font-semibold">Bookings by week</CardTitle></CardHeader>
          <CardContent>{o ? <WeeklyBookingsChart weeks={o.bookings_by_week} /> : <Skeleton className="h-48 w-full" />}</CardContent>
        </Card>
        <VerificationQueue />
      </div>
    </>
  )
}

interface Kpi {
  label: string
  value: string | undefined
  title?: string
  foot?: string
  to?: string // the card links there
}

function Kpis({ overview: o }: { overview: AdminOverview | undefined }) {
  const cards: Kpi[] = [
    { label: 'Gross bookings (30d)', value: o && rupeesShort(o.gross_paise_30d), title: o && rupees(o.gross_paise_30d) },
    { label: 'Bookings (30d)', value: o && count.format(o.bookings_30d), foot: o && `${count.format(o.completed_30d)} completed · ${count.format(o.cancelled_30d)} cancelled` },
    { label: 'Awaiting artist', value: o && count.format(o.awaiting_artist), foot: 'Requests not yet answered' },
    { label: 'Pending verification', value: o && count.format(o.pending_artists), foot: o && `${count.format(o.pending_custom_services)} custom services to review` },
    { label: 'Flagged reviews', value: o && count.format(o.flagged_reviews), foot: 'Waiting for a moderator', to: '/reviews' },
  ]
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
      {cards.map((c) => (
        <Card key={c.label} className={c.to && 'relative transition-colors hover:bg-muted/40'}>
          <CardContent>
            {c.to ? (
              // The link's overlay makes the whole card clickable.
              <Link to={c.to} className="text-xs text-muted-foreground after:absolute after:inset-0 hover:text-foreground">{c.label}</Link>
            ) : (
              <div className="text-xs text-muted-foreground">{c.label}</div>
            )}
            {c.value === undefined ? (
              <Skeleton className="mt-2 h-8 w-24" />
            ) : (
              <div className="mt-1 text-3xl font-semibold tracking-tight tabular-nums" title={c.title}>{c.value}</div>
            )}
            {c.foot && <div className="mt-1 text-xs text-muted-foreground">{c.foot}</div>}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

/** The first few submissions from the Verification queue, oldest first. */
function VerificationQueue() {
  const queue = useArtistQueue('pending')
  const artists = queue.data?.pages[0]?.items.slice(0, QUEUE_PREVIEW) ?? []

  return (
    <Card>
      <CardHeader className="flex items-center justify-between">
        <CardTitle className="font-semibold">Verification queue</CardTitle>
        <Link to="/artists" className="text-sm font-semibold text-primary hover:underline">Open queue</Link>
      </CardHeader>
      <CardContent>
        {queue.isPending && <Skeleton className="h-32 w-full" />}
        {queue.isError && <p className="text-sm text-destructive">Couldn’t load the queue. {queue.error.message}</p>}
        {queue.isSuccess && artists.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">No artists waiting for review.</p>}
        <ul className="divide-y">
          {artists.map((a) => (
            <li key={a.id}>
              <Link to={`/artists/${a.id}`} className="flex items-center gap-3 py-2.5 hover:opacity-80">
                <Avatar>
                  {a.photo_url && <AvatarImage src={a.photo_url} alt="" />}
                  <AvatarFallback>{a.business_name.slice(0, 1)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">{a.business_name}</div>
                  <div className="truncate text-xs text-muted-foreground">{[a.categories.join(', '), a.city, dateTime(a.submitted_at)].filter(Boolean).join(' · ')}</div>
                </div>
                <span className="rounded-full bg-[#FFE4EE] px-2.5 py-0.5 text-[11px] font-semibold text-primary">Review</span>
              </Link>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}
