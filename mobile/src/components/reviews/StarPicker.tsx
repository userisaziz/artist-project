import { View } from 'react-native';
import { PressableFeedback } from '../common/PressableFeedback';
import { AppText } from '../common/AppText';
import { useTheme } from '../../core/theme/theme-provider';
import type { StarRating } from '../../types/reviews/reviews';
import { Icon } from '../common/Icon';

const VALUES: StarRating[] = [1, 2, 3, 4, 5];
const STAR_SIZE = 34;
const TOUCH = 44;

interface StarPickerProps {
  value: StarRating | null;
  onChange: (rating: StarRating) => void;
  disabled?: boolean;
}

/** Five tappable stars; each is a button named "1 star" … "5 stars". */
export function StarPicker({ value, onChange, disabled = false }: StarPickerProps) {
  const theme = useTheme();
  return (
    <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', gap: 4 }}>
      {VALUES.map((n) => {
        const lit = value !== null && n <= value;
        return (
          <PressableFeedback
            key={n}
            accessibilityRole="radio"
            accessibilityLabel={`${n} ${n === 1 ? 'star' : 'stars'}`}
            accessibilityState={{ selected: value === n, disabled }}
            disabled={disabled}
            onPress={() => onChange(n)}
            style={{ width: TOUCH, height: TOUCH, alignItems: 'center', justifyContent: 'center' }}
          >
            <Icon name="star" size={STAR_SIZE} color={lit ? theme.colors.brand : theme.colors.border} filled={lit} />
          </PressableFeedback>
        );
      })}
    </View>
  );
}
