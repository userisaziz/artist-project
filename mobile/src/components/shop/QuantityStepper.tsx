import { View } from 'react-native';
import { PressableFeedback } from '../common/PressableFeedback';
import { AppText } from '../common/AppText';
import { useTheme } from '../../core/theme/theme-provider';
import { Icon } from '../common/Icon';

/** Minus, the quantity, plus: the cart line's quantity; minus at one removes the line. */
export function QuantityStepper({ name, quantity, max, onChange }: { name: string; quantity: number; max: number; onChange: (next: number) => void }) {
  const theme = useTheme();
  const button = { width: 32, height: 32, borderRadius: 16, borderWidth: 1, borderColor: theme.colors.separator, alignItems: 'center', justifyContent: 'center' } as const;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <PressableFeedback accessibilityRole="button" accessibilityLabel={quantity === 1 ? `Remove ${name}` : `One less ${name}`} onPress={() => onChange(quantity - 1)} hitSlop={6} style={button}>
        <Icon name="minus" size={16} />
      </PressableFeedback>
      <AppText variant="label" accessibilityLabel={`${quantity} in cart`} style={{ minWidth: 16, textAlign: 'center', color: theme.colors.textPrimary }}>{String(quantity)}</AppText>
      <PressableFeedback accessibilityRole="button" accessibilityLabel={`One more ${name}`} accessibilityState={{ disabled: quantity >= max }} disabled={quantity >= max} onPress={() => onChange(quantity + 1)} hitSlop={6} style={[button, { opacity: quantity >= max ? 0.4 : 1 }]}>
        <Icon name="plus" size={16} />
      </PressableFeedback>
    </View>
  );
}
