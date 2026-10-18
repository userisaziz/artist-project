import { useLocalSearchParams } from 'expo-router';
import { ChatThread } from '../../../src/components/chat/ChatThread';

// The artist's side of a client chat: opened from Messages or a booking request.
export default function ArtistChatScreen() {
  const { id = '' } = useLocalSearchParams<{ id: string }>();
  return <ChatThread side="artist" conversationId={id} />;
}
