import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { PressableFeedback } from '../../../src/components/common/PressableFeedback';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '../../../src/components/common/AppText';
import { EmptyView, ErrorView, LoadingView } from '../../../src/components/common/StateViews';
import { useTheme } from '../../../src/core/theme/theme-provider';
import { useArtistBookingsInRange } from '../../../src/hooks/bookings/bookings';
import { formatDay, formatLongDay, formatMonth, istDateKey, monthGrid, monthRange } from '../../../src/utils/common/time';
import { useNow } from '../../../src/hooks/common/use-now';
import { AgendaRow } from '../../../src/components/bookings/AgendaRow';
import { DayOffToggle } from '../../../src/components/artist-schedule/DayOffToggle';
import type { Booking } from '../../../src/types/bookings/bookings';
import { Icon } from '../../../src/components/common/Icon';

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const SHOWN: Booking['status'][] = ['requested', 'confirmed', 'completed']; // ended-without-service bookings hold no time

function shiftMonth({ year, month }: { year: number; month: number }, by: number) {
  const index = year * 12 + (month - 1) + by;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

// Spec §3 Calendar: a hand-built month grid with dots (pink confirmed, amber requested); a tapped day shows its agenda.
export default function ArtistCalendar() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const today = istDateKey(useNow());
  const [visible, setVisible] = useState(() => ({ year: Number(today.slice(0, 4)), month: Number(today.slice(5, 7)) }));
  const [selected, setSelected] = useState(today);
  const { from, to } = monthRange(visible.year, visible.month);
  const range = useArtistBookingsInRange(from, to);
  const byDay = new Map<string, Booking[]>();
  for (const b of range.data ?? []) {
    if (!SHOWN.includes(b.status)) continue;
    const key = istDateKey(b.start_at);
    byDay.set(key, [...(byDay.get(key) ?? []), b]);
  }
  const agenda = byDay.get(selected) ?? [];
  const move = (by: number) => setVisible((v) => shiftMonth(v, by));

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.colors.background }} contentContainerStyle={{ paddingTop: insets.top + theme.spacing.md, paddingHorizontal: theme.spacing.md, paddingBottom: theme.spacing.xl, gap: 12 }}>
      <AppText variant="display" style={{ fontSize: 30, lineHeight: 34, color: theme.colors.heading }}>Calendar</AppText>
      <View style={{ borderRadius: theme.radii.card, borderWidth: 1, borderColor: theme.colors.separator, padding: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <AppText variant="subtitle" style={{ flex: 1, fontSize: 15, color: theme.colors.textPrimary }}>{formatMonth(visible.year, visible.month)}</AppText>
          <PressableFeedback accessibilityRole="button" accessibilityLabel="Previous month" hitSlop={8} onPress={() => move(-1)} style={{ paddingHorizontal: 10 }}>
            <Icon name="chevron-left" size={22} color={theme.colors.brand} />
          </PressableFeedback>
          <PressableFeedback accessibilityRole="button" accessibilityLabel="Next month" hitSlop={8} onPress={() => move(1)} style={{ paddingHorizontal: 10 }}>
            <Icon name="chevron-right" size={22} color={theme.colors.brand} />
          </PressableFeedback>
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 10 }}>
          {WEEKDAYS.map((w, i) => (
            <View key={`${w}${i}`} style={{ width: `${100 / 7}%`, alignItems: 'center', paddingBottom: 6 }}>
              <AppText variant="label" style={{ fontSize: 11, color: theme.colors.textMuted }}>{w}</AppText>
            </View>
          ))}
          {monthGrid(visible.year, visible.month).map((key, i) => {
            if (!key) return <View key={`pad-${i}`} style={{ width: `${100 / 7}%`, height: 42 }} />;
            const day = byDay.get(key) ?? [];
            const isSelected = key === selected;
            const hasConfirmed = day.some((b) => b.status !== 'requested');
            const hasRequested = day.some((b) => b.status === 'requested');
            const count = day.length;
            return (
              <PressableFeedback
                key={key}
                accessibilityRole="button"
                accessibilityLabel={`${formatDay(key)}, ${count ? `${count} ${count === 1 ? 'booking' : 'bookings'}` : 'no bookings'}`}
                accessibilityState={{ selected: isSelected }}
                onPress={() => setSelected(key)}
                style={{ width: `${100 / 7}%`, height: 42, alignItems: 'center', justifyContent: 'center' }}
              >
                <View style={{ width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: isSelected ? theme.colors.brand : 'transparent', borderWidth: key === today && !isSelected ? 1 : 0, borderColor: theme.colors.brand }}>
                  <AppText variant="label" style={{ fontSize: 13, color: isSelected ? theme.colors.textOnBrand : theme.colors.textPrimary }}>{String(Number(key.slice(8)))}</AppText>
                </View>
                <View style={{ flexDirection: 'row', gap: 2, height: 4, marginTop: 1 }}>
                  {hasConfirmed ? <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: theme.colors.accent }} /> : null}
                  {hasRequested ? <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: theme.colors.pendingDot }} /> : null}
                </View>
              </PressableFeedback>
            );
          })}
        </View>
        <View style={{ flexDirection: 'row', gap: 14, marginTop: 6 }}>
          <AppText variant="caption" style={{ color: theme.colors.textMuted }}><AppText variant="caption" style={{ color: theme.colors.accent }}>●</AppText> Booked</AppText>
          <AppText variant="caption" style={{ color: theme.colors.textMuted }}><AppText variant="caption" style={{ color: theme.colors.pendingDot }}>●</AppText> Pending</AppText>
        </View>
      </View>

      <AppText variant="title" style={{ fontSize: 20, lineHeight: 26, color: theme.colors.heading, marginTop: 8 }}>{formatLongDay(selected)}</AppText>
      <DayOffToggle day={selected} today={today} />
      {range.isPending ? <LoadingView /> : null}
      {range.isError ? <ErrorView error={range.error} onRetry={() => { void range.refetch(); }} /> : null}
      {range.isSuccess && !agenda.length ? <EmptyView message="Nothing booked this day." /> : null}
      {agenda.map((b) => <AgendaRow key={b.id} booking={b} onPress={() => router.push({ pathname: '/artist/booking/[id]', params: { id: b.id } })} />)}
    </ScrollView>
  );
}
