import { View } from 'react-native';
import { Icon } from '../common/Icon';
import { useTheme } from '../../core/theme/theme-provider';
import { filledStars } from '../../utils/reviews/format';

const MAX_STARS = 5;
const STARS = Array.from({ length: MAX_STARS }, (_, i) => i);

/** Read-only rose stars, announced as "Rated 4 out of 5". */
export function Stars({ rating, size = 12 }: { rating: number; size?: number }) {
  const theme = useTheme();
  const full = filledStars(rating);
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={`Rated ${rating} out of ${MAX_STARS}`} style={{ flexDirection: 'row', gap: 1 }}>
      {STARS.map((i) => <Icon key={i} name="star" size={size} color={theme.colors.brand} filled={i < full} />)}
    </View>
  );
}
