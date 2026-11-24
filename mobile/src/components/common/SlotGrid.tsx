import { useState } from 'react';
import { View } from 'react-native';
import { PressableFeedback } from './PressableFeedback';
import { AppText } from './AppText';
import { BottomSheet } from './BottomSheet';
import { DayStrip } from './DayStrip';
import { Icon } from './Icon';
import { MonthPicker } from './MonthPicker';
import { EmptyView, ErrorView, LoadingView } from './StateViews';
import { useTheme } from '../../core/theme/theme-provider';
import { formatDay, formatTime } from '../../utils/common/time';

export interface GridSlot {
  start_at: string;
  available: boolean;
}

/** The parts of a day's slots query the grid renders (a TanStack Query result fits). */
export interface SlotsQuery {
  data: { slots: GridSlot[] } | undefined;
  isPending: boolean;
  isError: boolean;
  error: unknown;
  refetch: () => Promise<unknown>;
}

interface SlotGridProps {
  days: string[];
  date: string;
  onDateChange: (date: string) => void;
  slots: SlotsQuery;
  /** The picked start (ISO), or null. */
  value: string | null;
  onChange: (startAt: string | null) => void;
}

/** A day strip over that day's slots; taken ones are struck through. Changing the day clears the pick. */
export function SlotGrid({ days, date, onDateChange, slots, value, onChange }: SlotGridProps) {
  const theme = useTheme();
  const [calendarOpen, setCalendarOpen] = useState(false);
  const pickDay = (d: string) => { onDateChange(d); onChange(null); };
  return (
    <View>
      <DayStrip days={days} value={date} onChange={pickDay} />

      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <AppText variant="title" style={{ color: theme.colors.heading }}>{formatDay(date)}</AppText>
        <PressableFeedback accessibilityRole="button" accessibilityLabel="Pick a date from the calendar" onPress={() => setCalendarOpen(true)} hitSlop={theme.spacing[2]} style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing[1] }}>
          <Icon name="calendar" size={16} color={theme.colors.brand} />
          <AppText variant="labelLg" style={{ color: theme.colors.brand }}>Calendar</AppText>
        </PressableFeedback>
      </View>
      <BottomSheet visible={calendarOpen} title="Pick a date" onClose={() => setCalendarOpen(false)}>
        <MonthPicker min={days[0]} max={days[days.length - 1]} value={date} onChange={(d) => { pickDay(d); setCalendarOpen(false); }} />
      </BottomSheet>
      {slots.isPending ? <LoadingView /> : null}
      {slots.isError ? <ErrorView error={slots.error} onRetry={() => { void slots.refetch(); }} /> : null}
      {slots.data && !slots.data.slots.some((s) => s.available) ? <View style={{ marginTop: theme.spacing[2.5] }}><EmptyView message="No open times this day. Try another date." /></View> : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing[2], marginTop: theme.spacing[3] }}>
        {slots.data?.slots.map((s) => {
          const selected = s.start_at === value && s.available;
          const time = formatTime(s.start_at);
          return (
            <PressableFeedback
              key={s.start_at}
              accessibilityRole="button"
              accessibilityLabel={`${time}, ${s.available ? 'available' : 'taken'}`}
              accessibilityState={{ selected, disabled: !s.available }}
              disabled={!s.available}
              onPress={() => onChange(s.start_at)}
              style={{ width: '31.5%', height: 44, borderRadius: theme.radii.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: selected ? theme.colors.brand : s.available ? theme.colors.surface : theme.colors.canvas, borderWidth: selected ? 0 : 1, borderColor: theme.colors.separator }}
            >
              <AppText variant="labelLg" style={{ color: selected ? theme.colors.textOnBrand : s.available ? theme.colors.textPrimary : theme.colors.textMuted, textDecorationLine: s.available ? 'none' : 'line-through' }}>{time}</AppText>
            </PressableFeedback>
          );
        })}
      </View>
    </View>
  );
}
