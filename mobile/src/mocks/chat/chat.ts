import type { ChatMessage, Conversation } from '../../types/chat/chat';

// Fixtures mirror the backend's ConversationOut / MessageOut (app/chat/schemas.py).
export function conversationFixture(overrides: Partial<Conversation> = {}): Conversation {
  return {
    id: 'c1',
    counterpart: { id: 'u-ananya', name: 'Ananya Rao', photo_url: null },
    last_message: { sender: 'customer', text: 'Can you hide our initials in the design?', created_at: '2026-10-09T08:58:00Z' },
    unread_count: 1,
    booking: { id: 'b1', code: 'BK-7F3K2Q', status: 'requested', service_name: 'Bridal Classic', start_at: '2026-10-09T05:30:00Z' },
    ...overrides,
  };
}

export function messageFixture(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return { id: 'm1', sender: 'customer', text: 'Hi!', created_at: '2026-10-09T08:58:00Z', ...overrides };
}
