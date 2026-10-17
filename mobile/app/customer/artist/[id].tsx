import { useLocalSearchParams, useRouter } from 'expo-router';
import { Storefront } from '../../../src/components/directory/Storefront';

// Spec §2 Artist storefront; "Check availability" opens Date & time for the selected package, "See all reviews" the reviews.
export default function ArtistStorefrontScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  return (
    <Storefront
      artistId={id ?? ''}
      onCheckAvailability={(service) => router.push({ pathname: '/customer/book/[artistId]', params: { artistId: id ?? '', serviceId: service.id } })}
      onSeeAllReviews={() => router.push({ pathname: '/customer/artist/[id]/reviews', params: { id: id ?? '' } })}
    />
  );
}
