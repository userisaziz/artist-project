import { useState } from 'react';
import { View } from 'react-native';
import { PressableFeedback } from './PressableFeedback';
import { AppText } from './AppText';
import { Icon } from './Icon';
import { useTheme } from '../../core/theme/theme-provider';
import { formatDay, formatMonth, monthGrid } from '../../utils/common/time';

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const CELL_HEIGHT = 44;

interface MonthPickerProps {
  /** First and last selectable IST date keys ('YYYY-MM-DD'). */
  min: string;
  max: string;
  value: string;
  onChange: (day: string) => void;
}

const monthOf = (key: string) => ({ year: Number(key.slice(0, 4)), month: Number(key.slice(5, 7)) });
const shift = ({ year, month }: { year: number; month: number }, by: number) => {
  const index = year * 12 + (month - 1) + by;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
};
const monthKey = (m: { year: number; month: number }) => m.year * 12 + m.month;

/** A month grid for jumping to a date further out than a day strip reaches; days outside [min, max] are disabled. */
export function MonthPicker({ min, max, value, onChange }: MonthPickerProps) {
  const theme = useTheme();
  const [shown, setShown] = useState(monthOf(value));
  const canBack = monthKey(shown) > monthKey(monthOf(min));
  const canForward = monthKey(shown) < monthKey(monthOf(max));
  const cells = monthGrid(shown.year, shown.month);

  return (
    <View style={{ gap: theme.spacing[2] }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <PressableFeedback accessibilityRole="button" accessibilityLabel="Previous month" accessibilityState={{ disabled: !canBack }} disabled={!canBack} onPress={() => setShown(shift(shown, -1))} hitSlop={theme.spacing[2]} style={{ opacity: canBack ? 1 : 0.3, padding: theme.spacing[2] }}>
          <Icon name="chevron-left" />
        </PressableFeedback>
        <AppText variant="subtitle" accessibilityRole="header" style={{ color: theme.colors.textPrimary }}>{formatMonth(shown.year, shown.month)}</AppText>
        <PressableFeedback accessibilityRole="button" accessibilityLabel="Next month" accessibilityState={{ disabled: !canForward }} disabled={!canForward} onPress={() => setShown(shift(shown, 1))} hitSlop={theme.spacing[2]} style={{ opacity: canForward ? 1 : 0.3, padding: theme.spacing[2] }}>
          <Icon name="chevron-right" />
        </PressableFeedback>
      </View>
      <View style={{ flexDirection: 'row' }}>
        {WEEKDAYS.map((d, i) => (
          <AppText key={i} variant="caption" style={{ flex: 1, textAlign: 'center', color: theme.colors.textMuted }}>{d}</AppText>
        ))}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {cells.map((day, i) => {
          if (!day) return <View key={`blank-${i}`} style={{ width: `${100 / 7}%`, height: CELL_HEIGHT }} />;
          const enabled = day >= min && day <= max;
          const selected = day === value;
          return (
            <View key={day} style={{ width: `${100 / 7}%`, height: CELL_HEIGHT, padding: theme.spacing[0.5] }}>
              <PressableFeedback
                accessibilityRole="button"
                accessibilityLabel={formatDay(day)}
                accessibilityState={{ selected, disabled: !enabled }}
                disabled={!enabled}
                onPress={() => onChange(day)}
                style={{ flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: theme.radii.pill, backgroundColor: selected ? theme.colors.brand : 'transparent' }}
              >
                <AppText variant="label" style={{ color: selected ? theme.colors.textOnBrand : enabled ? theme.colors.textPrimary : theme.colors.textMuted, opacity: enabled ? 1 : 0.4 }}>
                  {String(Number(day.slice(8, 10)))}
                </AppText>
              </PressableFeedback>
            </View>
          );
        })}
      </View>
    </View>
  );
}
