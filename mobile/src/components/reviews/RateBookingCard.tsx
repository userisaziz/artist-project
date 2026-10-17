import { useState } from 'react';
import { View } from 'react-native';
import { AppText } from '../common/AppText';
import { AppButton } from '../common/AppButton';
import { AppTextField } from '../common/AppTextField';
import { Card } from '../common/Card';
import { useTheme } from '../../core/theme/theme-provider';
import { errorMessage } from '../../core/api/error-message';
import { usePostReview } from '../../hooks/reviews/reviews';
import { StarPicker } from './StarPicker';
import { Stars } from './Stars';
import type { Booking } from '../../types/bookings/bookings';
import type { StarRating } from '../../types/reviews/reviews';

const MAX_TEXT = 1000;
export const BEING_CHECKED = 'Thanks! Your review is being checked before it appears.';

/**
 * Spec §2.1 booking detail: "Rate your experience" while `can_review`; once reviewed, the stars and a thank-you
 * (or "being checked" when the auto-filter hid it). Nothing for bookings that can't be reviewed.
 */
export function RateBookingCard({ booking }: { booking: Booking }) {
  const theme = useTheme();
  const post = usePostReview();
  const [rating, setRating] = useState<StarRating | null>(null);
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (booking.review) {
    const checking = booking.review.status === 'hidden';
    return (
      <Card style={{ gap: 6 }}>
        <Stars rating={booking.review.rating} size={18} />
        <AppText variant="subtitle" style={{ color: theme.colors.textPrimary }}>{checking ? BEING_CHECKED : 'Thanks for your review'}</AppText>
      </Card>
    );
  }
  if (!booking.can_review) return null;

  const submit = async () => {
    if (rating === null) return;
    setSaving(true);
    setError(null);
    try {
      await post(booking.id, { rating, text: text.trim() || null }); // the booking's cache flips to the thank-you card
    } catch (e) {
      setError(errorMessage(e));
      setSaving(false);
    }
  };

  return (
    <Card style={{ gap: 12 }}>
      <View style={{ gap: 2 }}>
        <AppText variant="subtitle" style={{ color: theme.colors.textPrimary }}>Rate your experience</AppText>
        <AppText variant="caption" style={{ color: theme.colors.textMuted }}>{`How was ${booking.service_name} with ${booking.artist.business_name}?`}</AppText>
      </View>
      <StarPicker value={rating} onChange={setRating} disabled={saving} />
      <AppTextField
        label="Your review (optional)"
        value={text}
        onChangeText={setText}
        maxLength={MAX_TEXT}
        multiline
        placeholder="What did you love?"
        style={{ height: 100, paddingTop: 12, textAlignVertical: 'top' }}
      />
      <AppButton label="Post review" accessibilityLabel="Post review" loading={saving} disabled={rating === null} onPress={() => { void submit(); }} />
      {error ? <AppText variant="caption" style={{ color: theme.colors.error }}>{error}</AppText> : null}
    </Card>
  );
}
