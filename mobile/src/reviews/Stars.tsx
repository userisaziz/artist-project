import type { TextStyle } from 'react-native';
import { AppText } from '../components/AppText';
import { useTheme } from '../theme/theme-provider';
import { starString } from './format';

interface StarsProps {
  rating: number;
  size?: number;
  style?: TextStyle;
}

/** Read-only rose stars, announced as "Rated 4 out of 5". */
export function Stars({ rating, size = 12, style }: StarsProps) {
  const theme = useTheme();
  return (
    <AppText accessibilityLabel={`Rated ${rating} out of 5`} style={[{ color: theme.colors.brand, fontSize: size, letterSpacing: 1 }, style]}>
      {starString(rating)}
    </AppText>
  );
}
