import { Pressable, View } from 'react-native';
import { AppText } from './AppText';
import { Icon } from './Icon';
import { useTheme } from '../../core/theme/theme-provider';

interface StepperProps {
  /** What the value is, for screen readers: "Monday opens". */
  label: string;
  value: string;
  canDecrease: boolean;
  canIncrease: boolean;
  onDecrease: () => void;
  onIncrease: () => void;
}

/** Minus, a value, plus: small bounded numbers such as opening hours. */
export function Stepper({ label, value, canDecrease, canIncrease, onDecrease, onIncrease }: StepperProps) {
  const theme = useTheme();
  const button = { width: 30, height: 30, borderRadius: theme.radii.pill, borderWidth: 1, borderColor: theme.colors.separator, alignItems: 'center', justifyContent: 'center' } as const;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing[2] }}>
      <Pressable accessibilityRole="button" accessibilityLabel={`${label} earlier`} accessibilityState={{ disabled: !canDecrease }} disabled={!canDecrease} onPress={onDecrease} hitSlop={6} style={[button, { opacity: canDecrease ? 1 : 0.4 }]}>
        <Icon name="minus" size={14} />
      </Pressable>
      <AppText variant="label" accessibilityLabel={`${label} ${value}`} style={{ minWidth: 44, textAlign: 'center', color: theme.colors.textPrimary }}>{value}</AppText>
      <Pressable accessibilityRole="button" accessibilityLabel={`${label} later`} accessibilityState={{ disabled: !canIncrease }} disabled={!canIncrease} onPress={onIncrease} hitSlop={6} style={[button, { opacity: canIncrease ? 1 : 0.4 }]}>
        <Icon name="plus" size={14} />
      </Pressable>
    </View>
  );
}
