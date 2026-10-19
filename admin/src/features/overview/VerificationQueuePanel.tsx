import { Link } from 'react-router'
import { InitialsAvatar } from '@/components/console/initials-avatar'
import { Panel } from '@/components/console/panel'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { useArtistQueue } from '@/features/artists/queries'
import { dateTime } from '@/lib/format'
import { PATHS, artistPath } from '@/lib/paths'

const QUEUE_PREVIEW = 3

/** The first few submissions from the Verification queue, oldest first. */
export function VerificationQueuePanel() {
  const queue = useArtistQueue('pending')
  const artists = queue.data?.pages[0]?.items.slice(0, QUEUE_PREVIEW) ?? []

  return (
    <Panel className="p-4">
      <div className="flex justify-between">
        <h2 className="text-sm font-bold">Verification queue</h2>
        <Link to={PATHS.artists} className="text-[12.5px] font-semibold text-primary hover:text-primary-hover">Open queue</Link>
      </div>
      <div className="mt-2">
        {queue.isPending && <Skeleton className="h-32 w-full" />}
        {queue.isError && <p role="alert" className="py-6 text-[13px] text-destructive">Couldn’t load the queue. {queue.error.message}</p>}
        {queue.isSuccess && artists.length === 0 && <p className="py-6 text-center text-[13px] text-muted-foreground">No artists waiting for review.</p>}
        <ul>
          {artists.map((a) => (
            <li key={a.id} className="border-b border-line-soft last:border-b-0">
              <Link to={artistPath(a.id)} className="flex items-center gap-2.5 py-2.5 hover:opacity-80">
                <InitialsAvatar name={a.business_name} photoUrl={a.photo_url} size={34} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-bold">{a.business_name}</div>
                  <div className="truncate text-[11.5px] text-muted-foreground">{[a.categories.join(', '), a.city, dateTime(a.submitted_at)].filter(Boolean).join(' · ')}</div>
                </div>
                <Badge variant="brand" className="text-[11px]">Review</Badge>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </Panel>
  )
}
