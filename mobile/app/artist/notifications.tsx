import { useRouter, type Href } from 'expo-router';
import { NotificationInbox } from '../../src/components/notifications/NotificationInbox';

// Home → bell: the artist's notifications.
export default function ArtistNotifications() {
  const router = useRouter();
  return <NotificationInbox onNavigate={(link) => router.push(link as Href)} />;
}
