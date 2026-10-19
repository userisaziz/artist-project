import { useState } from 'react'
import { useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { FilterChips, type Chip } from '@/components/FilterChips'
import { PageHeader } from '@/components/PageHeader'
import { GridHeader } from '@/components/console/grid-header'
import { GridMessage } from '@/components/console/grid-message'
import { GridRow } from '@/components/console/grid-row'
import { KpiTile } from '@/components/console/kpi-tile'
import { Panel } from '@/components/console/panel'
import { PanelFooter } from '@/components/console/panel-footer'
import { PanelToolbar } from '@/components/console/panel-toolbar'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { dateTime } from '@/lib/format'
import { toastError } from '@/lib/notify'
import { PostStatusPill } from './PostStatusPill'
import { useAdminPosts, useFeedSummary, usePostAction } from './queries'
import type { AdminPost, Decision, FeedView } from './types'

const COLUMNS = '2.6fr .8fr .6fr .6fr .9fr 2fr'
const VIEWS: FeedView[] = ['all', 'featured', 'reported', 'hidden']
const VIEW_LABEL: Record<FeedView, string> = { all: 'All', featured: 'Featured', reported: 'Reported', hidden: 'Hidden' }
const CONFIRM: Record<'hide' | 'remove', { title: string; body: string; label: string }> = {
  hide: { title: 'Hide this post?', body: 'It leaves the Feed. The artist still sees it, marked as taken down.', label: 'Hide' },
  remove: { title: 'Remove this post?', body: 'It disappears from the Feed for good. This can’t be undone.', label: 'Remove' },
}
const number = new Intl.NumberFormat('en-IN')
const isView = (value: string | null): value is FeedView => VIEWS.includes(value as FeedView)

/** Design "Feed": moderate posts and articles, clear reports, and feature posts at the top of For you. */
export function FeedModerationPage() {
  const [params, setParams] = useSearchParams()
  const raw = params.get('view')
  const view = isView(raw) ? raw : 'all'
  const posts = useAdminPosts(view)
  const summary = useFeedSummary().data
  const action = usePostAction()
  const [confirming, setConfirming] = useState<{ post: AdminPost; decision: 'hide' | 'remove' } | null>(null)
  const rows = posts.data?.pages.flatMap((p) => p.items) ?? []
  const chips: Chip<FeedView>[] = VIEWS.map((v) => ({ value: v, label: summary ? `${VIEW_LABEL[v]} ${number.format(summary.counts[v])}` : VIEW_LABEL[v] }))

  const run = (post: AdminPost, a: Parameters<typeof action.mutate>[0]['action'], done: string) =>
    action.mutate({ id: post.id, action: a }, { onSuccess: () => toast.success(done), onError: (e) => toastError(e) })
  const moderate = (post: AdminPost, decision: Decision) => {
    if (decision === 'keep') run(post, { kind: 'moderate', decision }, 'Kept live, reports cleared')
    else setConfirming({ post, decision })
  }

  return (
    <>
      <PageHeader title="Feed" subtitle="Posts and articles from artists. Moderate, and feature what customers see first." />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiTile label="Posts this week" value={summary && number.format(summary.posts_7d)} />
        <KpiTile label="Reported" value={summary && number.format(summary.counts.reported)} note="Open reports" tone={summary?.counts.reported ? 'alert' : 'muted'} />
        <KpiTile label="Featured slots" value={summary && `${summary.counts.featured} / ${summary.featured_slots}`} note="Top of For you" />
        <KpiTile label="Hidden" value={summary && number.format(summary.counts.hidden)} note="Taken down by moderators" />
      </div>
      <Panel className="flex flex-col">
        <PanelToolbar>
          <FilterChips chips={chips} value={view} onChange={(next) => setParams(next === 'all' ? {} : { view: next })} />
        </PanelToolbar>
        <GridHeader columns={COLUMNS} labels={['Post', 'Type', 'Likes', 'Reports', 'Status', '']} />
        {posts.isPending && <GridMessage state="loading" />}
        {posts.isError && !posts.data && <GridMessage state="error">Couldn’t load posts. {posts.error.message}</GridMessage>}
        {posts.isSuccess && rows.length === 0 && <GridMessage state="empty">No posts here.</GridMessage>}
        {rows.map((p) => (
          <GridRow key={p.id} columns={COLUMNS}>
            <div className="flex min-w-0 items-center gap-2.5">
              {(p.cover_url ?? p.photos[0]?.url) && <img src={p.cover_url ?? p.photos[0]?.url} alt="" className="size-10 shrink-0 rounded-lg object-cover" />}
              <div className="min-w-0">
                <div className="truncate font-bold">{p.title ?? p.text ?? p.excerpt}</div>
                <div className="truncate text-[11.5px] text-muted-foreground">{p.artist.business_name} · {dateTime(p.created_at)}</div>
              </div>
            </div>
            <span className="capitalize">{p.kind === 'article' ? 'Article' : 'Photos'}</span>
            <span className="tabular-nums">{number.format(p.like_count)}</span>
            <span className="tabular-nums">{p.report_count}</span>
            <span><PostStatusPill post={p} /></span>
            <span className="flex flex-wrap justify-end gap-1">
              {p.moderation === 'live' && (
                <Button variant="ghost" size="xs" disabled={action.isPending} onClick={() => run(p, { kind: 'feature', on: !p.featured }, p.featured ? 'No longer featured' : 'Featured at the top of For you')}>
                  {p.featured ? 'Unfeature' : 'Feature'}
                </Button>
              )}
              {(p.report_count > 0 || p.moderation === 'hidden') && <Button variant="ghost" size="xs" disabled={action.isPending} onClick={() => moderate(p, 'keep')}>Keep</Button>}
              {p.moderation === 'live' && <Button variant="ghost" size="xs" disabled={action.isPending} onClick={() => moderate(p, 'hide')}>Hide</Button>}
              {p.moderation !== 'removed' && <Button variant="ghost" size="xs" className="text-destructive" disabled={action.isPending} onClick={() => moderate(p, 'remove')}>Remove</Button>}
            </span>
          </GridRow>
        ))}
        {posts.isSuccess && rows.length > 0 && (
          <PanelFooter
            end={posts.hasNextPage && (
              <Button variant="link" size="xs" onClick={() => { void posts.fetchNextPage() }} disabled={posts.isFetchingNextPage}>
                {posts.isFetchingNextPage ? 'Loading…' : 'Load more'}
              </Button>
            )}
          >
            Showing {number.format(rows.length)}{posts.hasNextPage ? '+' : ''}
          </PanelFooter>
        )}
      </Panel>
      <AlertDialog open={confirming !== null} onOpenChange={(open) => { if (!open) setConfirming(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirming && CONFIRM[confirming.decision].title}</AlertDialogTitle>
            <AlertDialogDescription>{confirming && CONFIRM[confirming.decision].body}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                if (!confirming) return
                run(confirming.post, { kind: 'moderate', decision: confirming.decision }, confirming.decision === 'hide' ? 'Post hidden' : 'Post removed')
                setConfirming(null)
              }}
            >
              {confirming && CONFIRM[confirming.decision].label}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
