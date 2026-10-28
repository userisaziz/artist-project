import { Pressable, ScrollView } from 'react-native';
import { AppText } from './AppText';
import { useTheme } from '../../core/theme/theme-provider';
import { dayParts, formatDay } from '../../utils/common/time';

const DAY_WIDTH = 56;

interface DayStripProps {
  /** IST date keys ('YYYY-MM-DD') in order. */
  days: string[];
  /** The selected day, or null when none is picked yet. */
  value: string | null;
  onChange: (day: string) => void;
}

/** A horizontal strip of days (weekday over day number); each reads as "Fri, 9 Oct". */
export function DayStrip({ days, value, onChange }: DayStripProps) {
  const theme = useTheme();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: theme.spacing[2], paddingVertical: theme.spacing[4] }}>
      {days.map((d) => {
        const selected = d === value;
        const { weekday, day } = dayParts(d);
        return (
          <Pressable
            key={d}
            accessibilityRole="button"
            accessibilityLabel={formatDay(d)}
            accessibilityState={{ selected }}
            onPress={() => onChange(d)}
            style={{ width: DAY_WIDTH, paddingVertical: theme.spacing[2.5], borderRadius: theme.radii.lg, alignItems: 'center', gap: theme.spacing[0.5], backgroundColor: selected ? theme.colors.brand : theme.colors.surface, borderWidth: selected ? 0 : 1, borderColor: theme.colors.separator }}
          >
            <AppText variant="caption" style={{ color: selected ? theme.colors.textOnBrand : theme.colors.textMuted }}>{weekday}</AppText>
            <AppText variant="subtitle" style={{ color: selected ? theme.colors.textOnBrand : theme.colors.textPrimary }}>{String(day)}</AppText>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
