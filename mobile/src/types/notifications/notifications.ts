// Mirrors backend app/notification/schemas.py.
export type NotificationKind =
  | 'booking_requested'
  | 'booking_accepted'
  | 'booking_declined'
  | 'booking_cancelled'
  | 'order_placed'
  | 'order_confirmed'
  | 'order_shipped'
  | 'order_delivered'
  | 'order_cancelled'
  | 'chat_message'
  | 'support_reply'
  | 'requirement_due'
  | 'requirement_on_hold'
  | 'requirement_reminder';

export interface AppNotification {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  /** An app route to open, e.g. /customer/booking/<id>. */
  link: string | null;
  read_at: string | null;
  created_at: string;
}
