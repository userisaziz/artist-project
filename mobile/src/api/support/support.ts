import { request } from '../../core/api/client';
import { withQuery } from '../../core/api/query-string';
import type { Page } from '../../core/api/types';
import type { ReportInput, SupportTicket } from '../../types/support/support';

// Help & support (backend app/support/router.py): the signed-in user's own tickets.
export function reportProblem(body: ReportInput) {
  return request<SupportTicket>('/support/tickets', body, { auth: true });
}
export function listMyTickets(cursor?: string | null) {
  return request<Page<SupportTicket>>(withQuery('/support/tickets', { cursor }), undefined, { auth: true, method: 'GET' });
}
export function getMyTicket(id: string) {
  return request<SupportTicket>(`/support/tickets/${encodeURIComponent(id)}`, undefined, { auth: true, method: 'GET' });
}
export function writeToSupport(id: string, text: string) {
  return request<SupportTicket>(`/support/tickets/${encodeURIComponent(id)}/messages`, { text }, { auth: true });
}
