import { View } from 'react-native';
import { AppText } from '../../components/AppText';
import { AppButton } from '../../components/AppButton';
import { StatusPill } from '../../components/StatusPill';
import { useTheme } from '../../theme/theme-provider';
import { STATUS_PILL, customerName } from '../../bookings/status';
import { formatDay, formatTime, istDateKey } from '../../bookings/time';
import { formatMaybePrice } from '../format';
import type { Booking } from '../../api/types';

interface AgendaRowProps {
  booking: Booking;
  /** Show the date under the time (lists spanning days); the calendar's single-day agenda leaves it out. */
  showDate?: boolean;
  /** Upcoming cards: "Mark completed", enabled once the start time has passed. */
  complete?: { enabled: boolean; busy: boolean; onPress: () => void; error?: string };
}

/** Time column, a coloured bar, the customer and service, and the status (Home "Today", Upcoming, Past, Calendar). */
export function AgendaRow({ booking, showDate = false, complete }: AgendaRowProps) {
  const theme = useTheme();
  const [clock, meridiem] = formatTime(booking.start_at).split(' ');
  const pill = STATUS_PILL[booking.status];
  const name = customerName(booking.customer);
  const bar = booking.status === 'requested' ? theme.colors.pendingDot : booking.status === 'confirmed' ? theme.colors.accent : theme.colors.border;
  return (
    <View style={{ borderRadius: 16, borderWidth: 1, borderColor: theme.colors.separator, backgroundColor: theme.colors.surface, padding: 12, gap: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ width: 56, alignItems: 'center' }}>
          <AppText variant="subtitle" style={{ fontSize: 15, color: theme.colors.textPrimary }}>{clock}</AppText>
          <AppText variant="caption" style={{ fontSize: 11, color: theme.colors.textMuted }}>{showDate ? `${meridiem} · ${formatDay(istDateKey(booking.start_at)).split(', ')[1]}` : meridiem}</AppText>
        </View>
        <View style={{ width: 3, height: 36, borderRadius: 2, backgroundColor: bar }} />
        <View style={{ flex: 1, gap: 2 }}>
          <AppText variant="subtitle" style={{ fontSize: 14, lineHeight: 19, color: theme.colors.textPrimary }}>{name}</AppText>
          <AppText variant="caption" style={{ color: theme.colors.textMuted }} numberOfLines={1}>{`${booking.service_name} · ${formatMaybePrice(booking.artist_earning_paise)}`}</AppText>
        </View>
        <StatusPill label={pill.label} tone={pill.tone} />
      </View>
      {complete ? (
        <>
          <AppButton
            label="Mark completed"
            accessibilityLabel={`Mark completed ${name}`}
            variant="secondary"
            disabled={!complete.enabled}
            loading={complete.busy}
            onPress={complete.onPress}
          />
          {complete.error ? <AppText variant="caption" style={{ color: theme.colors.error }}>{complete.error}</AppText> : null}
        </>
      ) : null}
    </View>
  );
}
