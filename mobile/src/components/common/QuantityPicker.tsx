import { TextInput, View } from 'react-native';
import { PressableFeedback } from './PressableFeedback';
import { AppText } from './AppText';
import { Icon } from './Icon';
import { useTheme } from '../../core/theme/theme-provider';

interface QuantityPickerProps {
  value: number;
  min: number;
  max: number;
  /** The unit's word for a count: (n) => "boxes". */
  noun: (count: number) => string;
  onChange: (value: number) => void;
}

/** Minus, a number you can also type (for 40 boxes nobody taps plus forty times), the unit, plus. Kept within
 *  [min, max]; leaving the field empty or too low snaps back to the minimum. */
export function QuantityPicker({ value, min, max, noun, onChange }: QuantityPickerProps) {
  const theme = useTheme();
  const clamp = (n: number) => Math.min(max, Math.max(min, n));
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing[2.5] }}>
      <StepButton icon="minus" label={`Fewer ${noun(2)}`} enabled={value > min} onPress={() => onChange(clamp(value - 1))} />
      <TextInput
        accessibilityLabel={`How many ${noun(2)}`}
        value={String(value)}
        keyboardType="number-pad"
        selectTextOnFocus
        maxLength={String(max).length}
        onChangeText={(t) => {
          const n = Number(t.replace(/[^0-9]/g, ''));
          if (n) onChange(Math.min(max, n));
        }}
        onEndEditing={() => onChange(clamp(value))}
        style={{
          minWidth: theme.spacing[12],
          paddingVertical: theme.spacing[1.5],
          paddingHorizontal: theme.spacing[2],
          borderRadius: theme.radii.md,
          borderWidth: 1,
          borderColor: theme.colors.border,
          backgroundColor: theme.colors.inputBackground,
          textAlign: 'center',
          color: theme.colors.textPrimary,
          fontFamily: theme.typography.label.fontFamily,
          fontSize: theme.typography.subtitle.fontSize,
        }}
      />
      <AppText variant="label" style={{ color: theme.colors.textSecondary }}>{noun(value)}</AppText>
      <StepButton icon="plus" label={`More ${noun(2)}`} enabled={value < max} onPress={() => onChange(clamp(value + 1))} />
    </View>
  );
}

function StepButton({ icon, label, enabled, onPress }: { icon: 'minus' | 'plus'; label: string; enabled: boolean; onPress: () => void }) {
  const theme = useTheme();
  const size = theme.spacing[8.5];
  return (
    <PressableFeedback
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !enabled }}
      disabled={!enabled}
      onPress={onPress}
      hitSlop={theme.spacing[1.5]}
      style={{ width: size, height: size, borderRadius: theme.radii.pill, borderWidth: 1, borderColor: theme.colors.separator, alignItems: 'center', justifyContent: 'center', opacity: enabled ? 1 : 0.4 }}
    >
      <Icon name={icon} size={14} />
    </PressableFeedback>
  );
}
