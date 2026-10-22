import { toast } from 'sonner'
import { Panel } from '@/components/console/panel'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { dateTime } from '@/lib/format'
import { toastError } from '@/lib/notify'
import { useArtistRequirements, useRemindArtist } from '../queries'

/** Mandatory profile items the artist still has to add, with a Remind action. Hidden when there is nothing to do. */
export function RequirementsCard({ artistId, name }: { artistId: string; name: string }) {
  const requirements = useArtistRequirements(artistId)
  const remind = useRemindArtist(artistId)
  if (requirements.isError) {
    return <Panel className="mt-3.5 p-3.5 text-[13px] text-destructive">Couldn’t load profile requirements. {requirements.error.message}</Panel>
  }
  const data = requirements.data
  if (!data || data.items.length === 0) return null
  const send = () => remind.mutate(undefined, {
    onSuccess: () => toast.success(`Reminder sent to ${name}`),
    onError: (e) => toastError(e),
  })
  return (
    <Panel className="mt-3.5 flex flex-col gap-2.5 p-3.5" aria-label="Profile requirements">
      <div className="flex items-center gap-2">
        <h2 className="text-[13px] font-bold">Profile requirements</h2>
        {data.on_hold ? <Badge variant="danger">On hold</Badge> : <Badge variant="warning">Grace period</Badge>}
        <span className="flex-1" />
        <Button size="sm" onClick={send} disabled={remind.isPending}>{remind.isPending ? 'Sending…' : 'Remind artist'}</Button>
      </div>
      {data.items.map((item) => (
        <div key={item.key} className="text-[13px]">
          <span className="font-semibold">{item.title}</span>
          <span className="text-muted-foreground"> · {item.overdue ? 'overdue since' : 'due'} {dateTime(item.due_at)}</span>
        </div>
      ))}
    </Panel>
  )
}
