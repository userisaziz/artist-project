/** Which side of a conversation a message came from, and which side the reader is on. */
export type ChatSide = 'customer' | 'artist';

export interface ChatMessage {
  id: string;
  sender: ChatSide;
  text: string;
  created_at: string;
}

export interface Counterpart {
  id: string; // artist profile id for customers, user id for artists
  name: string;
  photo_url: string | null;
}

/** The tagged booking's stage (backend BookingStatus). */
export type ChatBookingStatus = 'requested' | 'confirmed' | 'declined' | 'expired' | 'cancelled' | 'completed';

export interface ConversationBooking {
  id: string;
  code: string;
  status: ChatBookingStatus;
  service_name: string;
  start_at: string;
}

/** Always from the reader's side: `counterpart` is the other party, `unread_count` is the reader's. */
export interface Conversation {
  id: string;
  counterpart: Counterpart;
  last_message: { sender: ChatSide; text: string; created_at: string } | null;
  unread_count: number;
  booking: ConversationBooking | null;
}
