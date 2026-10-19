import { useState } from 'react'
import { X } from 'lucide-react'
import { toast } from 'sonner'
import { Panel } from '@/components/console/panel'
import { GridMessage } from '@/components/console/grid-message'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { dateTime } from '@/lib/format'
import { toastError } from '@/lib/notify'
import { TicketStatusPill } from './TicketStatusPill'
import { useTicket, useTicketAction } from './queries'
import type { Ticket } from './types'

const REPLY_MAX = 2000

/** Design support drawer, shown beside the queue: requester, conversation, reply, and Close / Assign to me. */
export function TicketPanel({ ticketId, onClose }: { ticketId: string; onClose: () => void }) {
  const ticket = useTicket(ticketId)
  return (
    <Panel className="flex max-h-[calc(100vh-160px)] flex-col overflow-hidden">
      <div className="flex items-start gap-3 border-b border-line p-4">
        <div className="min-w-0 flex-1">
          {ticket.data ? <TicketHeading ticket={ticket.data} /> : <span className="text-sm text-muted-foreground">Ticket</span>}
        </div>
        <Button variant="ghost" size="icon-sm" aria-label="Close ticket panel" onClick={onClose}><X aria-hidden /></Button>
      </div>
      {ticket.isPending && <GridMessage state="loading" />}
      {ticket.isError && <GridMessage state="error">Couldn’t load this ticket. {ticket.error.message}</GridMessage>}
      {ticket.data && <TicketBody ticket={ticket.data} />}
    </Panel>
  )
}

function TicketHeading({ ticket: t }: { ticket: Ticket }) {
  return (
    <>
      <div className="text-[11.5px] font-bold tracking-[0.08em] text-muted-foreground uppercase">{t.code} · {t.requester.side}</div>
      <h2 className="truncate text-[17px] font-bold">{t.subject}</h2>
      <div className="mt-1 flex flex-wrap items-center gap-2 text-[12.5px] text-muted-foreground">
        <TicketStatusPill ticket={t} />
        <span>{t.requester.name} · {t.requester.phone}</span>
        {t.booking && <span>· {t.booking.code} · {t.booking.artist_name}</span>}
      </div>
    </>
  )
}

function TicketBody({ ticket: t }: { ticket: Ticket }) {
  const action = useTicketAction(t.id)
  const [reply, setReply] = useState('')
  const run = (a: Parameters<typeof action.mutate>[0], done: string) =>
    action.mutate(a, { onSuccess: () => toast.success(done), onError: (e) => toastError(e) })
  const sendReply = () =>
    action.mutate({ kind: 'reply', text: reply.trim() }, {
      onSuccess: () => { setReply(''); toast.success('Reply sent') },
      onError: (e) => toastError(e),
    })

  return (
    <>
      <ol aria-label="Conversation" className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
        {t.messages.length === 0 && <li className="text-[13px] text-muted-foreground">No message yet: the requester only picked the issue.</li>}
        {t.messages.map((m) => (
          <li key={m.id} className={m.author === 'support' ? 'self-end rounded-xl bg-accent px-3 py-2' : 'self-start rounded-xl border border-line px-3 py-2'}>
            <div className="text-[11.5px] font-bold text-muted-foreground">{m.author_name} · {dateTime(m.created_at)}</div>
            <p className="text-[13px] whitespace-pre-wrap">{m.text}</p>
          </li>
        ))}
      </ol>
      <div className="flex flex-col gap-2 border-t border-line p-4">
        <label htmlFor="ticket-reply" className="text-[12.5px] font-bold">Reply</label>
        <Textarea id="ticket-reply" value={reply} onChange={(e) => setReply(e.target.value)} maxLength={REPLY_MAX} placeholder="Write to the requester…" rows={3} />
        <div className="flex flex-wrap gap-2">
          {t.status !== 'resolved' && <Button variant="outline" size="page" disabled={action.isPending} onClick={() => run({ kind: 'close' }, 'Ticket closed')}>Close</Button>}
          {!t.assignee && <Button variant="outline" size="page" disabled={action.isPending} onClick={() => run({ kind: 'assign' }, 'Assigned to you')}>Assign to me</Button>}
          {t.priority !== 'urgent' && t.status !== 'resolved' && (
            <Button variant="outline" size="page" disabled={action.isPending} onClick={() => run({ kind: 'priority', priority: 'urgent' }, 'Marked urgent')}>Mark urgent</Button>
          )}
          <span className="flex-1" />
          <Button size="page" disabled={!reply.trim() || action.isPending} onClick={sendReply}>Send reply</Button>
        </div>
      </div>
    </>
  )
}
