import { View } from 'react-native';
import { AppText } from '../common/AppText';
import { AppButton } from '../common/AppButton';
import { EmptyView, ErrorView, LoadingView } from '../common/StateViews';
import { useTheme } from '../../core/theme/theme-provider';
import { useReviewPreview } from '../../hooks/reviews/reviews';
import { ReviewCard } from './ReviewCard';
import { ReviewSummaryView } from './ReviewSummaryView';

interface StorefrontReviewsProps {
  artistId: string;
  businessName: string;
  /** "See all reviews"; absent where there is no all-reviews screen (the artist's own preview). */
  onSeeAll?: () => void;
}

/** Spec §2.1 storefront Reviews: the big average, the 5→1 distribution and the newest three. */
export function StorefrontReviews({ artistId, businessName, onSeeAll }: StorefrontReviewsProps) {
  const theme = useTheme();
  const { data, isPending, isError, error, refetch } = useReviewPreview(artistId);
  const heading = { fontSize: 22, lineHeight: 28, color: theme.colors.heading, marginTop: 26, marginBottom: 10 } as const;

  return (
    <View>
      <AppText variant="title" style={heading}>Reviews</AppText>
      {isPending ? <LoadingView label="Loading reviews" /> : null}
      {isError ? <ErrorView error={error} onRetry={() => { void refetch(); }} /> : null}
      {data && !data.summary.count ? <EmptyView message="No reviews yet. Reviews come from completed bookings." /> : null}
      {data && data.summary.count ? (
        <View style={{ gap: 12 }}>
          <ReviewSummaryView summary={data.summary} />
          {data.items.map((r) => <ReviewCard key={r.id} review={r} businessName={businessName} />)}
          {onSeeAll ? <AppButton label="See all reviews" variant="secondary" onPress={onSeeAll} /> : null}
        </View>
      ) : null}
    </View>
  );
}
