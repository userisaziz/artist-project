import { View } from 'react-native';
import type { ReactNode } from 'react';
import { AppText } from '../common/AppText';
import { Avatar } from '../common/Avatar';
import { Card } from '../common/Card';
import { useTheme } from '../../core/theme/theme-provider';
import { reviewMeta } from '../../utils/reviews/format';
import { Stars } from './Stars';
import type { Review } from '../../types/reviews/reviews';

interface ReviewCardProps {
  review: Review;
  /** The artist's business name, for "Response from <business>". */
  businessName: string;
  /** Status pill (artist view), shown above the reviewer. */
  header?: ReactNode;
  /** Actions (artist view), shown at the bottom. */
  children?: ReactNode;
}

/** Spec §2.1 review card: name, "service · month", stars, text, and the artist's reply indented below. */
export function ReviewCard({ review, businessName, header, children }: ReviewCardProps) {
  const theme = useTheme();
  return (
    <Card style={{ gap: 10 }}>
      {header}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Avatar uri={null} name={review.reviewer_name} size={36} />
        <View style={{ flex: 1 }}>
          <AppText variant="subtitle" style={{ fontSize: 13.5, lineHeight: 18, color: theme.colors.textPrimary }}>{review.reviewer_name}</AppText>
          <AppText variant="caption" style={{ color: theme.colors.textMuted }}>{reviewMeta(review)}</AppText>
        </View>
        <Stars rating={review.rating} />
      </View>
      {review.text ? <AppText variant="body" style={{ fontSize: 13.5, lineHeight: 21, color: theme.colors.textSecondary }}>{review.text}</AppText> : null}
      {review.reply ? (
        <View style={{ marginLeft: 12, paddingLeft: 12, borderLeftWidth: 2, borderLeftColor: theme.colors.brandSoft, gap: 2 }}>
          <AppText variant="label" style={{ fontSize: 12, color: theme.colors.brand }}>{`Response from ${businessName}`}</AppText>
          <AppText variant="body" style={{ fontSize: 13, lineHeight: 20, color: theme.colors.textSecondary }}>{review.reply}</AppText>
        </View>
      ) : null}
      {children}
    </Card>
  );
}
