import { View } from 'react-native';
import { AppText } from '../common/AppText';
import { InfoRow } from '../common/InfoRow';
import { useTheme } from '../../core/theme/theme-provider';
import { formatPrice } from '../../utils/common/format';
import type { BookingAddon } from '../../types/bookings/bookings';

type Line = Pick<BookingAddon, 'name' | 'per_person' | 'guests' | 'line_paise'>;

/** The add-ons on a booking (or about to be): "Guest mehendi × 4 ₹2,000". Renders nothing without any. */
export function AddonLines({ lines }: { lines: Line[] }) {
  const theme = useTheme();
  if (!lines.length) return null;
  return (
    <View>
      <AppText variant="caption" style={{ color: theme.colors.textMuted, marginBottom: 2 }}>Add-ons</AppText>
      {lines.map((l) => (
        <InfoRow key={l.name} label={l.per_person ? `${l.name} × ${l.guests}` : l.name} value={formatPrice(l.line_paise)} />
      ))}
    </View>
  );
}
