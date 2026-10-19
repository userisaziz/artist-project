import { useLocalSearchParams, useRouter } from 'expo-router';
import { Storefront } from '../../../src/components/directory/Storefront';
import { useChatOpener } from '../../../src/hooks/chat/chat';

// Spec §2 Artist storefront; "Check availability" opens Date & time for the selected package, "See all reviews" the reviews, "Message" the chat.
export default function ArtistStorefrontScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const chat = useChatOpener('customer');
  return (
    <Storefront
      artistId={id ?? ''}
      onCheckAvailability={(service) => router.push({ pathname: '/customer/book/[artistId]', params: { artistId: id ?? '', serviceId: service.id } })}
      onSeeAllReviews={() => router.push({ pathname: '/customer/artist/[id]/reviews', params: { id: id ?? '' } })}
      onOpenService={(service) => router.push({ pathname: '/customer/artist/[id]/service/[serviceId]', params: { id: id ?? '', serviceId: service.id } })}
      onMessage={() => { void chat.open(id ?? ''); }}
      messaging={chat.openingId === id}
    />
  );
}
