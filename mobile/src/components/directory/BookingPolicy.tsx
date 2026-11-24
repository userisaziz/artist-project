import { View } from 'react-native';
import { AppText } from '../common/AppText';
import { Icon, type IconName } from '../common/Icon';
import { useTheme } from '../../core/theme/theme-provider';
import { bookingPolicyLines } from '../../utils/bookings/pricing';

const ICONS: IconName[] = ['clock', 'check', 'sparkles'];

/** "Booking & cancellation": how a request is answered, when cancelling is free, and how payment works,
 *  shown before booking (storefront, service detail) rather than only at the last step. */
export function BookingPolicy() {
  const theme = useTheme();
  return (
    <View accessibilityLabel="Booking and cancellation policy" style={{ gap: theme.spacing[2.5], borderRadius: theme.radii.card, borderWidth: 1, borderColor: theme.colors.separator, backgroundColor: theme.colors.surface, padding: theme.spacing[3.5] }}>
      <AppText variant="subtitle" accessibilityRole="header" style={{ color: theme.colors.textPrimary }}>Booking & cancellation</AppText>
      {bookingPolicyLines().map((line, i) => (
        <View key={line} style={{ flexDirection: 'row', gap: theme.spacing[2.5], alignItems: 'flex-start' }}>
          <Icon name={ICONS[i] ?? 'check'} size={16} color={theme.colors.brand} />
          <AppText variant="body" size="sm" style={{ flex: 1, color: theme.colors.textSecondary }}>{line}</AppText>
        </View>
      ))}
    </View>
  );
}
