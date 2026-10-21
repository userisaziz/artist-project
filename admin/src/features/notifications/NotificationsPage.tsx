import { useNavigate } from 'react-router'
import { Accent } from '@/components/accent'
import { GridMessage } from '@/components/console/grid-message'
import { Panel } from '@/components/console/panel'
import { PanelFooter } from '@/components/console/panel-footer'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { dateTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useMarkNotificationsRead, useNotifications } from './queries'
import type { AdminNotification } from './types'

/** New artists to review, support tickets, reported posts and subcategory suggestions, newest first. */
export function NotificationsPage() {
  const list = useNotifications()
  const markRead = useMarkNotificationsRead()
  const rows = list.data?.pages.flatMap((p) => p.items) ?? []
  const anyUnread = rows.some((n) => !n.read_at)

  return (
    <>
      <PageHeader
        title={<>Notifications <Accent>inbox</Accent></>}
        subtitle="What needs an admin: new and edited artist profiles, support tickets, reported posts and subcategory suggestions."
        action={anyUnread && (
          <Button variant="outline" size="sm" onClick={() => markRead.mutate(null)} disabled={markRead.isPending}>Mark all read</Button>
        )}
      />
      <Panel className="flex flex-col">
        {list.isPending && <GridMessage state="loading" />}
        {list.isError && <GridMessage state="error">Couldn’t load notifications. {list.error.message}</GridMessage>}
        {list.isSuccess && rows.length === 0 && <GridMessage state="empty">Nothing yet. New submissions, tickets and reports show up here.</GridMessage>}
        <ul>
          {rows.map((n) => <NotificationRow key={n.id} notification={n} />)}
        </ul>
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
    </>
  )
}

function NotificationRow({ notification: n }: { notification: AdminNotification }) {
  const navigate = useNavigate()
  const markRead = useMarkNotificationsRead()
  const unread = !n.read_at
  const open = () => {
    if (unread) markRead.mutate([n.id])
    if (n.link?.startsWith('/')) void navigate(n.link)
  }
  return (
    <li className="border-b border-line last:border-b-0">
      <button
        type="button"
        onClick={open}
        aria-label={`${unread ? 'Unread: ' : ''}${n.title}. ${n.body}`}
        className="flex w-full items-start gap-3 px-5 py-3.5 text-left hover:bg-muted/50 focus-visible:outline-2 focus-visible:outline-ring"
      >
        <span aria-hidden className={cn('mt-1.5 size-2 shrink-0 rounded-full', unread ? 'bg-primary' : 'bg-transparent')} />
        <span className="min-w-0 flex-1">
          <span className={cn('block text-[13.5px]', unread ? 'font-bold' : 'font-medium')}>{n.title}</span>
          <span className="block truncate text-[12.5px] text-muted-foreground">{n.body}</span>
        </span>
        <span className="shrink-0 text-[12px] text-muted-foreground">{dateTime(n.created_at)}</span>
      </button>
    </li>
  )
}
