import { View } from 'react-native';
import { AppText } from '../common/AppText';
import { Icon } from '../common/Icon';
import { InfoRow } from '../common/InfoRow';
import { PressableFeedback } from '../common/PressableFeedback';
import { useTheme } from '../../core/theme/theme-provider';
import { formatPrice } from '../../utils/common/format';
import { addonLineLabel } from '../../utils/bookings/addons';

export interface SummaryAddon {
  /** Set when the line can be removed (before the request is sent). */
  id?: string;
  name: string;
  per_person: boolean;
  guests: number;
  line_paise: number;
}

interface OrderSummaryProps {
  serviceName: string;
  servicePaise: number;
  /** Guests for a per-person service: the package line reads "× 4 guests". */
  quantity?: number;
  addons: SummaryAddon[];
  /** Shows a remove control on each add-on line, like a cart. */
  onRemove?: (addonId: string) => void;
}

/** What is being booked, line by line: the package, each add-on (× guests) and the total of the two. */
export function OrderSummary({ serviceName, servicePaise, quantity, addons, onRemove }: OrderSummaryProps) {
  const theme = useTheme();
  const total = servicePaise + addons.reduce((sum, a) => sum + a.line_paise, 0);
  return (
    <View accessibilityLabel="Your booking" style={{ gap: theme.spacing[0.5] }}>
      <InfoRow label={quantity ? `${serviceName} × ${quantity} ${quantity === 1 ? 'guest' : 'guests'}` : serviceName} value={formatPrice(servicePaise)} />
      {addons.map((a) => {
        const label = addonLineLabel(a);
        return (
          <View key={a.id ?? a.name} style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing[2] }}>
            <View style={{ flex: 1 }}>
              <InfoRow label={`+ ${label}`} value={formatPrice(a.line_paise)} />
            </View>
            {onRemove && a.id ? (
              <PressableFeedback
                accessibilityRole="button"
                accessibilityLabel={`Remove ${label}`}
                onPress={() => { if (a.id) onRemove(a.id); }}
                hitSlop={theme.spacing[3]}
                style={{ width: theme.spacing[6], height: theme.spacing[6], borderRadius: theme.radii.pill, backgroundColor: theme.colors.neutralSoft, alignItems: 'center', justifyContent: 'center' }}
              >
                <Icon name="close" size={14} color={theme.colors.textSecondary} />
              </PressableFeedback>
            ) : null}
          </View>
        );
      })}
      {onRemove && !addons.length ? (
        <AppText variant="caption" style={{ color: theme.colors.textMuted }}>No add-ons picked.</AppText>
      ) : null}
      <View style={{ height: 1, backgroundColor: theme.colors.separator, marginVertical: theme.spacing[1.5] }} />
      <InfoRow label={addons.length ? 'Service + add-ons' : 'Service'} value={formatPrice(total)} strong />
    </View>
  );
}
