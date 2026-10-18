import { useLocalSearchParams } from 'expo-router';
import { ChatThread } from '../../../src/components/chat/ChatThread';

// Prototype "Chat with artist": opened from the storefront, a booking, or Profile → Messages.
export default function CustomerChatScreen() {
  const { id = '' } = useLocalSearchParams<{ id: string }>();
  return <ChatThread side="customer" conversationId={id} />;
}
