import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Accent } from '@/components/accent'
import { GridMessage } from '@/components/console/grid-message'
import { Panel } from '@/components/console/panel'
import { PanelFooter } from '@/components/console/panel-footer'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { FilterSelect, type FilterOption } from '@/components/ui/filter-select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { useCategories } from '@/features/categories/queries'
import { dateTime } from '@/lib/format'
import { toastError } from '@/lib/notify'
import { useBroadcastPreview, useBroadcasts, useCities, useSendBroadcast } from './queries'
import type { AdminBroadcast, BroadcastFilters, BroadcastSegment } from './types'

const SEGMENT_OPTIONS: FilterOption<BroadcastSegment>[] = [
  { value: 'all_users', label: 'Everyone' },
  { value: 'all_artists', label: 'All artists' },
  { value: 'all_customers', label: 'All customers' },
]

const STATUS_OPTIONS: FilterOption<'approved' | 'pending' | 'draft'>[] = [
  { value: 'approved', label: 'Approved' },
  { value: 'pending', label: 'Pending' },
  { value: 'draft', label: 'Draft' },
]

const SEGMENT_LABEL: Record<string, string> = {
  all_users: 'Everyone',
  all_artists: 'All artists',
  all_customers: 'All customers',
}

/** A broadcast's link must be an in-app path (`/x`), never an absolute URL. Mirrors the backend rule. */
const LINK_PATTERN = /^\/(?:[^/]|$)/

/** Compose an announcement, see its exact audience, confirm, and send it to in-app inboxes and push. */
export function BroadcastsPage() {
  const [segment, setSegment] = useState<BroadcastSegment>('all_users')
  const [city, setCity] = useState('')
  const [status, setStatus] = useState<'approved' | 'pending' | 'draft'>('approved')
  const [categoryId, setCategoryId] = useState('')
  const [joinedFrom, setJoinedFrom] = useState('')
  const [joinedTo, setJoinedTo] = useState('')
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [link, setLink] = useState('')
  const [confirming, setConfirming] = useState(false)

  const { data: cities = [] } = useCities()
  const { data: categories = [] } = useCategories()
  const history = useBroadcasts()
  const send = useSendBroadcast()
  const rows = history.data?.pages.flatMap((p) => p.items) ?? []

  const artistFiltersVisible = segment !== 'all_customers'
  // Memoised so the debounce below only restarts when a filter actually changes, not on every render.
  const filters = useMemo<BroadcastFilters>(
    () => ({
      city: city || null,
      artist_status: artistFiltersVisible ? status : null,
      category_id: categoryId ? Number(categoryId) : null,
      joined_from: joinedFrom || null,
      joined_to: joinedTo || null,
    }),
    [city, artistFiltersVisible, status, categoryId, joinedFrom, joinedTo],
  )

  // The audience query runs on the settled state, so edits debounce instead of firing per keystroke.
  const [settled, setSettled] = useState({ segment, filters })
  useEffect(() => {
    const timer = setTimeout(() => setSettled({ segment, filters }), 300)
    return () => clearTimeout(timer)
  }, [segment, filters])
  const preview = useBroadcastPreview(settled.segment, settled.filters)
  const counts = preview.data

  const linkValid = link === '' || LINK_PATTERN.test(link)
  const canSend = title.trim() !== '' && message.trim() !== '' && linkValid && (counts?.recipients ?? 0) > 0

  const cityOptions: FilterOption<string>[] = [
    { value: '', label: 'Any city' },
    ...cities.map((c) => ({ value: c, label: c })),
  ]
  const categoryOptions = useMemo<FilterOption<string>[]>(() => {
    const nameOf = new Map(categories.map((c) => [c.id, c.name]))
    return [
      { value: '', label: 'Any category' },
      ...categories.map((c) => ({
        value: String(c.id),
        label: c.parent_id ? `${nameOf.get(c.parent_id)} › ${c.name}` : c.name,
      })),
    ]
  }, [categories])

  const reachLine = preview.isFetching
    ? 'Counting…'
    : counts === undefined
      ? 'Pick an audience to see its size.'
      : counts.recipients === 0
        ? 'No one matches this audience yet.'
        : `This will reach ${counts.recipients} people, ${counts.with_push} with push.`

  return (
    <>
      <PageHeader
        title={<>Broadcasts <Accent>composer</Accent></>}
        subtitle="Compose an announcement, check exactly who it reaches, then send it to in-app inboxes and push."
      />

      <Panel className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <FilterSelect
            label="Audience"
            value={segment}
            options={SEGMENT_OPTIONS}
            onValueChange={(next) => {
              setSegment(next)
              if (next === 'all_customers') {
                setCity('')
                setStatus('approved')
                setCategoryId('')
              }
            }}
          />
          {artistFiltersVisible && <FilterSelect<'approved' | 'pending' | 'draft'> label="Status" value={status} options={STATUS_OPTIONS} onValueChange={setStatus} />}
          {artistFiltersVisible && <FilterSelect label="City" value={city} options={cityOptions} onValueChange={setCity} />}
          {artistFiltersVisible && <FilterSelect label="Category" value={categoryId} options={categoryOptions} onValueChange={setCategoryId} />}
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <Label htmlFor="broadcast-joined-from">Signed up from</Label>
            <Input id="broadcast-joined-from" type="date" className="w-44" value={joinedFrom} onChange={(e) => setJoinedFrom(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="broadcast-joined-to">Signed up until</Label>
            <Input id="broadcast-joined-to" type="date" className="w-44" value={joinedTo} onChange={(e) => setJoinedTo(e.target.value)} />
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="flex flex-col gap-1">
            <Label htmlFor="broadcast-title">Title</Label>
            <Input id="broadcast-title" value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} />
            <span className="text-[11px] text-muted-foreground">{title.length}/120</span>
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="broadcast-link">Link (optional)</Label>
            <Input id="broadcast-link" placeholder="/customer/discover" value={link} maxLength={200} onChange={(e) => setLink(e.target.value)} />
            {!linkValid && <span className="text-[12px] text-destructive">Link must be an in-app path starting with /</span>}
          </div>
          <div className="flex flex-col gap-1 md:col-span-2">
            <Label htmlFor="broadcast-message">Message</Label>
            <Textarea id="broadcast-message" rows={3} value={message} maxLength={300} onChange={(e) => setMessage(e.target.value)} />
            <span className="text-[11px] text-muted-foreground">{message.length}/300</span>
          </div>
        </div>
        <PanelFooter
          end={
            <Button size="sm" onClick={() => setConfirming(true)} disabled={!canSend}>
              Send broadcast
            </Button>
          }
        >
          {reachLine}
        </PanelFooter>
      </Panel>

      <Panel className="flex flex-col">
        {history.isPending && <GridMessage state="loading" />}
        {history.isError && <GridMessage state="error">Couldn’t load past broadcasts. {history.error.message}</GridMessage>}
        {history.isSuccess && rows.length === 0 && <GridMessage state="empty">No broadcasts sent yet.</GridMessage>}
        {rows.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Announcement</TableHead>
                <TableHead>Audience</TableHead>
                <TableHead>Reached</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((b) => <BroadcastRow key={b.id} row={b} />)}
            </TableBody>
          </Table>
        )}
        {history.isSuccess && rows.length > 0 && (
          <PanelFooter
            end={history.hasNextPage && (
              <Button variant="link" size="xs" onClick={() => { void history.fetchNextPage() }} disabled={history.isFetchingNextPage}>
                {history.isFetchingNextPage ? 'Loading…' : 'Load more'}
              </Button>
            )}
          >
            Showing {rows.length}{history.hasNextPage ? '+' : ''}
          </PanelFooter>
        )}
      </Panel>

      <Dialog open={confirming} onOpenChange={setConfirming}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send this broadcast?</DialogTitle>
            <DialogDescription>
              {counts ? `This will reach ${counts.recipients} people, ${counts.with_push} with push.` : ''}
            </DialogDescription>
          </DialogHeader>
          <p className="text-label-lg font-semibold">{title.trim()}</p>
          <p className="text-[13px] text-muted-foreground">{message.trim()}</p>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setConfirming(false)}>Cancel</Button>
            <Button
              size="sm"
              disabled={send.isPending}
              onClick={() => {
                // Send the audience the admin actually saw counted, never a filter edit the preview hasn't caught up with.
                send.mutate(
                  { segment: settled.segment, filters: settled.filters, title: title.trim(), body: message.trim(), link: link.trim() || null },
                  {
                    onSuccess: (sent) => {
                      toast.success(`Sent to ${sent.recipients} ${sent.recipients === 1 ? 'person' : 'people'}`)
                      setTitle('')
                      setMessage('')
                      setLink('')
                    },
                    onError: (error) => toastError(error, 'Could not send the broadcast'),
                  },
                )
                setConfirming(false)
              }}
            >
              {send.isPending ? 'Sending…' : 'Send now'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

function BroadcastRow({ row: b }: { row: AdminBroadcast }) {
  const filterBits = Object.values(b.filters ?? {}).filter((v): v is string => typeof v === 'string' && v !== '')
  return (
    <TableRow>
      <TableCell className="whitespace-nowrap text-muted-foreground">{dateTime(b.created_at)}</TableCell>
      <TableCell>
        <span className="block font-medium">{b.title}</span>
        <span className="block max-w-[360px] truncate text-[12.5px] text-muted-foreground">{b.body}</span>
      </TableCell>
      <TableCell>
        <span className="block">{SEGMENT_LABEL[b.segment] ?? b.segment}</span>
        {filterBits.length > 0 && <span className="block text-[12px] text-muted-foreground">{filterBits.join(' · ')}</span>}
      </TableCell>
      <TableCell>
        {b.recipient_count} people · {b.push_count} with push
      </TableCell>
    </TableRow>
  )
}
