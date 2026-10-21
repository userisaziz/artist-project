import { useLocalSearchParams, useRouter } from 'expo-router';
import { Storefront } from '../../../src/components/directory/Storefront';
import { useChatOpener } from '../../../src/hooks/chat/chat';
import { useSaveToggle } from '../../../src/hooks/saved/saved';

// Spec §2 Artist storefront; "Check availability" opens Date & time for the selected package, "See all reviews" the reviews, "Message" the chat, "Request a quote" a custom enquiry.
export default function ArtistStorefrontScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const chat = useChatOpener('customer');
  const save = useSaveToggle('artist');
  return (
    <Storefront
      artistId={id ?? ''}
      onCheckAvailability={(service) => router.push({ pathname: '/customer/book/[artistId]', params: { artistId: id ?? '', serviceId: service.id } })}
      onSeeAllReviews={() => router.push({ pathname: '/customer/artist/[id]/reviews', params: { id: id ?? '' } })}
      onOpenService={(service) => router.push({ pathname: '/customer/artist/[id]/service/[serviceId]', params: { id: id ?? '', serviceId: service.id } })}
      onMessage={() => { void chat.open(id ?? ''); }}
      messaging={chat.openingId === id}
      onRequestQuote={() => router.push({ pathname: '/customer/enquiry/new/[artistId]', params: { artistId: id ?? '' } })}
      save={save}
    />
  );
}
