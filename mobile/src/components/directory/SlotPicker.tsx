import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { AppText } from '../common/AppText';
import { EmptyView, ErrorView, LoadingView } from '../common/StateViews';
import { useTheme } from '../../core/theme/theme-provider';
import { useAvailability } from '../../hooks/directory/directory';
import { useNow } from '../../hooks/common/use-now';
import { addDays, dayParts, formatDay, formatTime, istDateKey } from '../../utils/common/time';

const STRIP_DAYS = 14;

interface SlotPickerProps {
  artistId: string;
  serviceId: string;
  /** The picked start (ISO), or null. */
  value: string | null;
  onChange: (startAt: string | null) => void;
}

/** A 14-day strip and the day's hourly IST slots for one service; taken ones are struck through. Booking and
 *  rescheduling both use it. Changing the day clears the pick. */
export function SlotPicker({ artistId, serviceId, value, onChange }: SlotPickerProps) {
  const theme = useTheme();
  const today = istDateKey(useNow());
  const [date, setDate] = useState(today);
  const slots = useAvailability(artistId, date, serviceId);
  const days = Array.from({ length: STRIP_DAYS }, (_, i) => addDays(today, i));

  return (
    <View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 16 }}>
        {days.map((d) => {
          const selected = d === date;
          const { weekday, day } = dayParts(d);
          return (
            <Pressable
              key={d}
              accessibilityRole="button"
              accessibilityLabel={formatDay(d)}
              accessibilityState={{ selected }}
              onPress={() => { setDate(d); onChange(null); }}
              style={{ width: 56, paddingVertical: 10, borderRadius: 16, alignItems: 'center', gap: 2, backgroundColor: selected ? theme.colors.brand : theme.colors.surface, borderWidth: selected ? 0 : 1, borderColor: theme.colors.separator }}
            >
              <AppText variant="caption" style={{ color: selected ? theme.colors.textOnBrand : theme.colors.textMuted }}>{weekday}</AppText>
              <AppText variant="subtitle" style={{ color: selected ? theme.colors.textOnBrand : theme.colors.textPrimary }}>{String(day)}</AppText>
            </Pressable>
          );
        })}
      </ScrollView>

      <AppText variant="title" style={{ color: theme.colors.heading }}>{formatDay(date)}</AppText>
      {slots.isPending ? <LoadingView /> : null}
      {slots.isError ? <ErrorView error={slots.error} onRetry={() => { void slots.refetch(); }} /> : null}
      {slots.data && !slots.data.slots.some((s) => s.available) ? <View style={{ marginTop: 10 }}><EmptyView message="No open times this day. Try another date." /></View> : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
        {slots.data?.slots.map((s) => {
          const selected = s.start_at === value && s.available;
          const time = formatTime(s.start_at);
          return (
            <Pressable
              key={s.start_at}
              accessibilityRole="button"
              accessibilityLabel={`${time}, ${s.available ? 'available' : 'taken'}`}
              accessibilityState={{ selected, disabled: !s.available }}
              disabled={!s.available}
              onPress={() => onChange(s.start_at)}
              style={{ width: '31.5%', height: 44, borderRadius: theme.radii.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: selected ? theme.colors.brand : s.available ? theme.colors.surface : theme.colors.canvas, borderWidth: selected ? 0 : 1, borderColor: theme.colors.separator }}
            >
              <AppText variant="label" style={{ fontSize: 13, color: selected ? theme.colors.textOnBrand : s.available ? theme.colors.textPrimary : theme.colors.textMuted, textDecorationLine: s.available ? 'none' : 'line-through' }}>{time}</AppText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

