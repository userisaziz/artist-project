import { Switch, View } from 'react-native';
import { AppText } from '../common/AppText';
import { useTheme } from '../../core/theme/theme-provider';
import { errorMessage } from '../../core/api/error-message';
import { useSchedule, useSetDayOff } from '../../hooks/artist-schedule/artist-schedule';

interface DayOffToggleProps {
  /** IST date, 'YYYY-MM-DD'; only today or later can be switched. */
  day: string;
  today: string;
}

/** Calendar: take the selected day off (no new bookings) or open it again. Existing bookings stay. */
export function DayOffToggle({ day, today }: DayOffToggleProps) {
  const theme = useTheme();
  const schedule = useSchedule();
  const setDayOff = useSetDayOff();
  if (day < today || !schedule.data) return null;
  const off = schedule.data.days_off.includes(day);

  return (
    <View style={{ gap: 4 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ flex: 1 }}>
          <AppText variant="label" style={{ color: theme.colors.textPrimary }}>Day off</AppText>
          <AppText variant="caption" style={{ color: theme.colors.textMuted }}>
            {off ? 'Clients can’t book this day. Existing bookings stay.' : 'Turn on to stop new bookings this day.'}
          </AppText>
        </View>
        <Switch
          accessibilityLabel="Day off"
          value={off}
          disabled={setDayOff.isPending}
          onValueChange={(next) => setDayOff.mutate({ day, off: next })}
          trackColor={{ true: theme.colors.brand, false: theme.colors.separator }}
        />
      </View>
      {setDayOff.isError ? <AppText variant="caption" accessibilityRole="alert" style={{ color: theme.colors.error }}>{errorMessage(setDayOff.error)}</AppText> : null}
    </View>
  );
}
