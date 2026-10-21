import { useState } from 'react';
import { Pressable, ScrollView, Switch, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppButton } from '../common/AppButton';
import { AppText } from '../common/AppText';
import { AppTextField } from '../common/AppTextField';
import { BackHeader } from '../common/BackHeader';
import { Card } from '../common/Card';
import { Icon } from '../common/Icon';
import { ErrorView, LoadingView } from '../common/StateViews';
import { Stepper } from '../common/Stepper';
import { useTheme } from '../../core/theme/theme-provider';
import { errorMessage } from '../../core/api/error-message';
import { useSaveSchedule, useSchedule, useSetDayOff } from '../../hooks/artist-schedule/artist-schedule';
import { formatDay } from '../../utils/common/time';
import { WEEKDAY_SHORT, formatHour, type WeeklyHour } from '../../utils/common/weekly-hours';
import type { Schedule } from '../../types/artist-schedule/artist-schedule';

const WEEKDAY_LONG = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const RADIUS_MAX = 100; // backend travel_radius_km 1..100

/** Me → Working hours: which days and hours clients can book, days off, and how far the artist travels. */
export function WorkingHoursForm() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const schedule = useSchedule();
  const frame = { paddingTop: insets.top + theme.spacing.sm, paddingHorizontal: theme.spacing.md, backgroundColor: theme.colors.background };

  if (!schedule.data) {
    return (
      <View style={[frame, { flex: 1 }]}>
        <BackHeader title="Working hours" />
        {schedule.isError ? <ErrorView error={schedule.error} onRetry={() => { void schedule.refetch(); }} /> : <LoadingView label="Loading your hours" />}
      </View>
    );
  }
  return <ScheduleFields schedule={schedule.data} />;
}

function ScheduleFields({ schedule }: { schedule: Schedule }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const save = useSaveSchedule();
  const dayOff = useSetDayOff();
  const [hours, setHours] = useState<WeeklyHour[]>(() => [...schedule.hours].sort((a, b) => a.weekday - b.weekday));
  const [radius, setRadius] = useState(schedule.travel_radius_km === null ? '' : String(schedule.travel_radius_km));
  const [saved, setSaved] = useState(false);
  const radiusKm = radius.trim() ? Number(radius) : null;
  const radiusProblem = radiusKm !== null && (!Number.isInteger(radiusKm) || radiusKm < 1 || radiusKm > RADIUS_MAX)
    ? `Travel radius is a whole number from 1 to ${RADIUS_MAX} km` : null;

  const change = (weekday: number, patch: Partial<WeeklyHour>) => {
    setSaved(false);
    setHours((all) => all.map((h) => (h.weekday === weekday ? { ...h, ...patch } : h)));
  };
  const submit = () => {
    if (radiusProblem) return;
    save.mutate({ hours, travel_radius_km: radiusKm }, { onSuccess: () => setSaved(true) });
  };

  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      contentContainerStyle={{ paddingTop: insets.top + theme.spacing.sm, paddingHorizontal: theme.spacing.md, paddingBottom: insets.bottom + theme.spacing.xl, gap: 14 }}
    >
      <BackHeader title="Working hours" />
      <AppText variant="body" style={{ color: theme.colors.textSecondary }}>Clients can book times that start and finish inside these hours (IST).</AppText>
      <Card style={{ gap: 4 }}>
        {hours.map((h) => (
          <View key={h.weekday} style={{ paddingVertical: 8, gap: 8, borderBottomWidth: h.weekday < 6 ? 1 : 0, borderBottomColor: theme.colors.separator }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <AppText variant="label" style={{ color: theme.colors.textPrimary }}>{WEEKDAY_LONG[h.weekday]}</AppText>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <AppText variant="caption" style={{ color: theme.colors.textMuted }}>{h.is_open ? 'Open' : 'Closed'}</AppText>
                <Switch
                  accessibilityLabel={`${WEEKDAY_LONG[h.weekday]} open`}
                  value={h.is_open}
                  onValueChange={(on) => change(h.weekday, { is_open: on })}
                  trackColor={{ true: theme.colors.brand, false: theme.colors.separator }}
                />
              </View>
            </View>
            {h.is_open ? (
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Stepper
                  label={`${WEEKDAY_SHORT[h.weekday]} opens`}
                  value={formatHour(h.open_hour)}
                  canDecrease={h.open_hour > 0}
                  canIncrease={h.open_hour < h.close_hour - 1}
                  onDecrease={() => change(h.weekday, { open_hour: h.open_hour - 1 })}
                  onIncrease={() => change(h.weekday, { open_hour: h.open_hour + 1 })}
                />
                <Stepper
                  label={`${WEEKDAY_SHORT[h.weekday]} closes`}
                  value={formatHour(h.close_hour)}
                  canDecrease={h.close_hour > h.open_hour + 1}
                  canIncrease={h.close_hour < 24}
                  onDecrease={() => change(h.weekday, { close_hour: h.close_hour - 1 })}
                  onIncrease={() => change(h.weekday, { close_hour: h.close_hour + 1 })}
                />
              </View>
            ) : null}
          </View>
        ))}
      </Card>

      <AppTextField
        label="Travel radius in km (optional)"
        keyboardType="number-pad"
        placeholder="15"
        value={radius}
        onChangeText={(t) => { setSaved(false); setRadius(t); }}
        error={radiusProblem}
        maxLength={3}
      />
      <AppText variant="caption" style={{ color: theme.colors.textMuted, marginTop: -8 }}>Shown on your profile so clients know if you come to them.</AppText>

      <AppButton label={saved ? 'Saved' : 'Save hours'} loading={save.isPending} disabled={!!radiusProblem} onPress={submit} />
      {save.isError ? <AppText variant="caption" accessibilityRole="alert" style={{ color: theme.colors.error }}>{errorMessage(save.error)}</AppText> : null}

      <AppText variant="title" style={{ color: theme.colors.heading, marginTop: 8 }}>Days off</AppText>
      {schedule.days_off.length ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {schedule.days_off.map((day) => (
            <Pressable
              key={day}
              accessibilityRole="button"
              accessibilityLabel={`Remove day off ${formatDay(day)}`}
              disabled={dayOff.isPending}
              onPress={() => dayOff.mutate({ day, off: false })}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: theme.radii.pill, backgroundColor: theme.colors.brandSoft }}
            >
              <AppText variant="label" style={{ color: theme.colors.textPrimary }}>{formatDay(day)}</AppText>
              <Icon name="close" size={14} color={theme.colors.textSecondary} />
            </Pressable>
          ))}
        </View>
      ) : (
        <AppText variant="body" style={{ color: theme.colors.textMuted }}>No days off coming up. Mark one from the Calendar.</AppText>
      )}
      {dayOff.isError ? <AppText variant="caption" accessibilityRole="alert" style={{ color: theme.colors.error }}>{errorMessage(dayOff.error)}</AppText> : null}
    </ScrollView>
  );
}
