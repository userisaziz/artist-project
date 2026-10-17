import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '../../../src/components/common/AppText';
import { AppButton } from '../../../src/components/common/AppButton';
import { BackHeader } from '../../../src/components/common/BackHeader';
import { ErrorView, LoadingView, EmptyView } from '../../../src/components/common/StateViews';
import { useTheme } from '../../../src/core/theme/theme-provider';
import { useArtistPublic, useAvailability } from '../../../src/hooks/directory/directory';
import { useBookingFlow } from '../../../src/context/bookings/flow-context';
import { addDays, dayParts, formatDay, formatTime, formatWhen, istDateKey } from '../../../src/utils/common/time';
import { formatPrice, formatDuration } from '../../../src/utils/common/format';
import { useNow } from '../../../src/hooks/common/use-now';

const STRIP_DAYS = 14;

// Spec §2 Date & time (step 1 of 2): a 14-day strip and the day's hourly IST slots; taken ones are struck through.
export default function DateTimeScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { artistId = '', serviceId = '' } = useLocalSearchParams<{ artistId: string; serviceId: string }>();
  const now = useNow();
  const today = istDateKey(now);
  const [date, setDate] = useState(today);
  const [startAt, setStartAt] = useState<string | null>(null);
  const { notice, setNotice } = useBookingFlow();
  const artist = useArtistPublic(artistId);
  const slots = useAvailability(artistId, date, serviceId);
  const service = artist.data?.services.find((s) => s.id === serviceId);
  // A slot that turned out to be taken (refetch after a conflict) is no longer a choice.
  const chosen = slots.data?.slots.some((s) => s.start_at === startAt && s.available) ? startAt : null;
  const days = Array.from({ length: STRIP_DAYS }, (_, i) => addDays(today, i));

  const pickDate = (d: string) => { setDate(d); setStartAt(null); };
  const pickSlot = (s: string) => { setStartAt(s); setNotice(null); };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + theme.spacing.sm, paddingHorizontal: theme.spacing.md, paddingBottom: 140 + insets.bottom }}>
        <BackHeader title="Date & time" step="Step 1 of 2" />
        {service ? (
          <AppText variant="body" style={{ color: theme.colors.textSecondary, marginTop: 8 }}>
            {`${service.name} · ${formatDuration(service.duration_minutes)} with ${artist.data?.business_name ?? ''}`}
          </AppText>
        ) : null}
        {notice ? (
          <View accessibilityLiveRegion="polite" style={{ marginTop: 12, borderRadius: theme.radii.md, backgroundColor: theme.colors.pendingSoft, padding: 12 }}>
            <AppText variant="label" style={{ color: theme.colors.pendingInk }}>{notice}</AppText>
          </View>
        ) : null}

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
                onPress={() => pickDate(d)}
                style={{ width: 56, paddingVertical: 10, borderRadius: 16, alignItems: 'center', gap: 2, backgroundColor: selected ? theme.colors.brand : theme.colors.surface, borderWidth: selected ? 0 : 1, borderColor: theme.colors.separator }}
              >
                <AppText variant="caption" style={{ color: selected ? theme.colors.textOnBrand : theme.colors.textMuted }}>{weekday}</AppText>
                <AppText variant="subtitle" style={{ color: selected ? theme.colors.textOnBrand : theme.colors.textPrimary }}>{String(day)}</AppText>
              </Pressable>
            );
          })}
        </ScrollView>

        <AppText variant="title" style={{ color: theme.colors.heading }}>{formatDay(date)}</AppText>
        {slots.isPending || artist.isPending ? <LoadingView /> : null}
        {slots.isError ? <ErrorView error={slots.error} onRetry={() => { void slots.refetch(); }} /> : null}
        {artist.isError ? <ErrorView error={artist.error} onRetry={() => { void artist.refetch(); }} /> : null}
        {slots.data && !slots.data.slots.some((s) => s.available) ? <View style={{ marginTop: 10 }}><EmptyView message="No open times this day. Try another date." /></View> : null}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
          {slots.data?.slots.map((s) => {
            const selected = s.start_at === chosen;
            const time = formatTime(s.start_at);
            return (
              <Pressable
                key={s.start_at}
                accessibilityRole="button"
                accessibilityLabel={`${time}, ${s.available ? 'available' : 'taken'}`}
                accessibilityState={{ selected, disabled: !s.available }}
                disabled={!s.available}
                onPress={() => pickSlot(s.start_at)}
                style={{ width: '31.5%', height: 44, borderRadius: theme.radii.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: selected ? theme.colors.brand : s.available ? theme.colors.surface : theme.colors.canvas, borderWidth: selected ? 0 : 1, borderColor: theme.colors.separator }}
              >
                <AppText variant="label" style={{ fontSize: 13, color: selected ? theme.colors.textOnBrand : s.available ? theme.colors.textPrimary : theme.colors.textMuted, textDecorationLine: s.available ? 'none' : 'line-through' }}>{time}</AppText>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: theme.spacing.md, paddingTop: 12, paddingBottom: insets.bottom + 12, backgroundColor: theme.colors.surface, borderTopWidth: 1, borderTopColor: theme.colors.separator, gap: 10 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <AppText variant="subtitle" style={{ fontSize: 14.5, color: chosen ? theme.colors.textPrimary : theme.colors.textMuted }}>{chosen ? formatWhen(chosen) : 'Pick a time'}</AppText>
          {service ? <AppText variant="subtitle" style={{ fontSize: 14.5, color: theme.colors.brand }}>{formatPrice(service.price_paise)}</AppText> : null}
        </View>
        <AppButton
          label="Continue"
          disabled={!chosen || !service}
          onPress={() => { if (chosen) router.push({ pathname: '/customer/book/review', params: { artistId, serviceId, startAt: chosen } }); }}
        />
      </View>
    </View>
  );
}
