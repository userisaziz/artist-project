import type { SupportTicket } from '../../types/support/support';

// Mirrors backend TicketOut (app/support/schemas.py).
export function ticketFixture(overrides: Partial<SupportTicket> = {}): SupportTicket {
  return {
    id: 't-1',
    code: 'T-7720',
    subject: 'Artist didn’t show up',
    topic: 'booking',
    issue: 'artist_no_show',
    status: 'new',
    priority: 'urgent',
    channel: 'app',
    booking: { id: 'b-1', code: 'BK-7F3K2Q', service_name: 'Bridal Classic', artist_name: 'Ayesha Mehendi Art' },
    created_at: '2026-10-09T09:00:00Z',
    messages: [{ id: 'm-1', author: 'requester', author_name: 'Ananya Rao', text: 'Waited an hour', created_at: '2026-10-09T09:00:00Z' }],
    ...overrides,
  };
}
