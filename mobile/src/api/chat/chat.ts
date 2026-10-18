import { request } from '../../core/api/client';
import { withQuery } from '../../core/api/query-string';
import type { Page } from '../../core/api/types';
import type { ChatMessage, ChatSide, Conversation } from '../../types/chat/chat';

// Chat (backend app/chat): the same endpoints under /conversations for customers, /artists/me/conversations for artists.
const BASE: Record<ChatSide, string> = { customer: '/conversations', artist: '/artists/me/conversations' };
const one = (side: ChatSide, id: string) => `${BASE[side]}/${encodeURIComponent(id)}`;

/** Customer: open (or reopen) the chat with an approved artist. */
export function openChatWithArtist(artistId: string) {
  return request<Conversation>(BASE.customer, { artist_id: artistId }, { auth: true });
}
/** Artist: open (or reopen) the chat with one of their bookings' customer. */
export function openChatFromBooking(bookingId: string) {
  return request<Conversation>(BASE.artist, { booking_id: bookingId }, { auth: true });
}
export function listConversations(side: ChatSide, cursor?: string | null, q?: string) {
  return request<Page<Conversation>>(withQuery(BASE[side], { cursor, q: q || undefined }), undefined, { auth: true, method: 'GET' });
}
/** Newest first. */
export function listMessages(side: ChatSide, conversationId: string, cursor?: string | null) {
  return request<Page<ChatMessage>>(withQuery(`${one(side, conversationId)}/messages`, { cursor }), undefined, { auth: true, method: 'GET' });
}
export function sendMessage(side: ChatSide, conversationId: string, text: string) {
  return request<ChatMessage>(`${one(side, conversationId)}/messages`, { text }, { auth: true });
}
export function markRead(side: ChatSide, conversationId: string) {
  return request<Conversation>(`${one(side, conversationId)}/read`, undefined, { auth: true });
}
export function getConversation(side: ChatSide, conversationId: string) {
  return request<Conversation>(one(side, conversationId), undefined, { auth: true, method: 'GET' });
}
