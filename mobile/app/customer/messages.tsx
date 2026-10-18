import { useRouter } from 'expo-router';
import { ChatInbox } from '../../src/components/chat/ChatInbox';
import { BackHeader } from '../../src/components/common/BackHeader';

// Profile → Messages: the customer's chats with artists, latest first.
export default function CustomerMessages() {
  const router = useRouter();
  return (
    <ChatInbox
      side="customer"
      header={<BackHeader title="Messages" />}
      onOpen={(id) => router.push({ pathname: '/customer/chat/[id]', params: { id } })}
    />
  );
}
