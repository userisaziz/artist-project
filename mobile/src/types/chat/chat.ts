/** Which side of a conversation a message came from, and which side the reader is on. */
export type ChatSide = 'customer' | 'artist';

/** Only on the reader's own message: held while an admin checks contact details, or hidden (never delivered). */
export type ChatModeration = 'held' | 'hidden';

export interface ChatMessage {
  id: string;
  sender: ChatSide;
  /** "" when the message is only a photo. */
  text: string;
  /** Full-size photo; null for text only. A message still sending shows the local file here. */
  photo_url: string | null;
  created_at: string;
  moderation: ChatModeration | null;
}

/** What the composer sends: text, an uploaded photo (purpose "chat"), or both. */
export interface OutgoingMessage {
  text: string;
  photo?: { key: string; localUri: string };
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
