import { Pressable, View } from 'react-native';
import { AppText } from '../common/AppText';
import { useTheme } from '../../core/theme/theme-provider';

/** "−  2  +": the cart line's quantity; "−" at one removes the line. */
export function QuantityStepper({ name, quantity, max, onChange }: { name: string; quantity: number; max: number; onChange: (next: number) => void }) {
  const theme = useTheme();
  const button = { width: 32, height: 32, borderRadius: 16, borderWidth: 1, borderColor: theme.colors.separator, alignItems: 'center', justifyContent: 'center' } as const;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <Pressable accessibilityRole="button" accessibilityLabel={quantity === 1 ? `Remove ${name}` : `One less ${name}`} onPress={() => onChange(quantity - 1)} hitSlop={6} style={button}>
        <AppText style={{ color: theme.colors.textPrimary }}>−</AppText>
      </Pressable>
      <AppText variant="label" accessibilityLabel={`${quantity} in cart`} style={{ minWidth: 16, textAlign: 'center', color: theme.colors.textPrimary }}>{String(quantity)}</AppText>
      <Pressable accessibilityRole="button" accessibilityLabel={`One more ${name}`} accessibilityState={{ disabled: quantity >= max }} disabled={quantity >= max} onPress={() => onChange(quantity + 1)} hitSlop={6} style={[button, { opacity: quantity >= max ? 0.4 : 1 }]}>
        <AppText style={{ color: theme.colors.textPrimary }}>+</AppText>
      </Pressable>
    </View>
  );
}
