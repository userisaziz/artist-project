import { View } from 'react-native';
import { PressableFeedback } from './PressableFeedback';
import { AppText } from './AppText';
import { Icon } from './Icon';
import { useTheme } from '../../core/theme/theme-provider';

interface CountStepperProps {
  /** What is counted, singular and plural: ['guest', 'guests']. */
  noun: [string, string];
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}

/** Minus, "4 guests", plus: how many of something, within [min, max]. */
export function CountStepper({ noun, value, min, max, onChange }: CountStepperProps) {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing[2.5] }}>
      <StepButton icon="minus" label={`Fewer ${noun[1]}`} enabled={value > min} onPress={() => onChange(value - 1)} />
      <AppText variant="label" accessibilityLiveRegion="polite" style={{ minWidth: theme.spacing[12] * 1.5, textAlign: 'center', color: theme.colors.textPrimary }}>
        {`${value} ${value === 1 ? noun[0] : noun[1]}`}
      </AppText>
      <StepButton icon="plus" label={`More ${noun[1]}`} enabled={value < max} onPress={() => onChange(value + 1)} />
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
