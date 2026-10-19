// Mirrors backend app/support/schemas.py.
export type SupportTopic = 'booking' | 'account';
export type TicketStatus = 'new' | 'open' | 'waiting_on_user' | 'resolved';

export interface SupportMessage {
  id: string;
  author: 'requester' | 'support';
  author_name: string;
  text: string;
  created_at: string;
}

export interface SupportTicket {
  id: string;
  code: string;
  subject: string;
  topic: SupportTopic;
  issue: string;
  status: TicketStatus;
  priority: 'low' | 'normal' | 'urgent';
  channel: 'app' | 'phone';
  booking: { id: string; code: string; service_name: string; artist_name: string } | null;
  created_at: string;
  messages: SupportMessage[];
}

export interface ReportInput {
  topic: SupportTopic;
  issue: string;
  booking_id?: string | null;
  details?: string | null;
}

/** A booking the customer can report about (built by the route from their bookings). */
export interface ReportableBooking {
  id: string;
  label: string; // 'Bridal Classic · 9 Oct'
}
