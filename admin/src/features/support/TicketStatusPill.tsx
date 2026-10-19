import { Badge } from '@/components/ui/badge'
import type { Ticket } from './types'

const PILL = {
  new: { label: 'New', variant: 'brand' },
  open: { label: 'Open', variant: 'warning' },
  waiting_on_user: { label: 'Waiting on user', variant: 'neutral' },
  resolved: { label: 'Resolved', variant: 'success' },
} as const

/** Design statuses; an unresolved urgent ticket shows "Urgent" in red instead. */
export function TicketStatusPill({ ticket }: { ticket: Pick<Ticket, 'status' | 'priority'> }) {
  if (ticket.priority === 'urgent' && ticket.status !== 'resolved') return <Badge variant="danger">Urgent</Badge>
  const { label, variant } = PILL[ticket.status]
  return <Badge variant={variant}>{label}</Badge>
}
