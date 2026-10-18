import { useRouter } from 'expo-router';
import { ChatInbox } from '../../../src/components/chat/ChatInbox';

// Prototype artist Messages: client chats, latest first, searchable by client name.
export default function ArtistMessages() {
  const router = useRouter();
  return <ChatInbox side="artist" searchable onOpen={(id) => router.push({ pathname: '/artist/chat/[id]', params: { id } })} />;
}
