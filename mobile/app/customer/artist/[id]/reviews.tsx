import { useLocalSearchParams } from 'expo-router';
import { AllReviews } from '../../../../src/components/reviews/AllReviews';

// Spec §2.1 "See all reviews" from the storefront.
export default function ArtistReviewsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <AllReviews artistId={id ?? ''} />;
}
