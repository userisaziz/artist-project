import { View } from 'react-native';
import { PressableFeedback } from '../common/PressableFeedback';
import { AppText } from '../common/AppText';
import { Icon } from '../common/Icon';
import { useTheme } from '../../core/theme/theme-provider';
import { formatPrice } from '../../utils/common/format';
import { servicePriceLabel } from '../../utils/directory/storefront';
import type { PublicService } from '../../types/directory/directory';

interface SuggestedServicesProps {
  services: PublicService[];
  /** Booking: each row opens that service (one booking holds one service). */
  onOpen?: (service: PublicService) => void;
  /** Quote request: each row is ticked to be quoted in the same enquiry. */
  picked?: string[];
  onToggle?: (service: PublicService) => void;
}

/** "Goes well with": more of the artist's services, shown while reviewing a booking or asking for a quote. Rows
 *  either open the service or tick it into the quote. Nothing when there are none. */
export function SuggestedServices({ services, onOpen, picked, onToggle }: SuggestedServicesProps) {
  const theme = useTheme();
  if (!services.length) return null;
  const ticking = onToggle !== undefined;
  return (
    <View style={{ gap: theme.spacing[2] }}>
      <AppText variant="subtitle" accessibilityRole="header" style={{ color: theme.colors.textPrimary }}>Goes well with</AppText>
      {ticking ? <AppText variant="caption" style={{ color: theme.colors.textMuted }}>Tick any you’d like priced in the same quote.</AppText> : null}
      {services.map((s) => {
        const on = picked?.includes(s.id) ?? false;
        const price = servicePriceLabel(s, formatPrice);
        return (
          <PressableFeedback
            key={s.id}
            accessibilityRole={ticking ? 'checkbox' : 'button'}
            accessibilityState={ticking ? { checked: on } : undefined}
            accessibilityLabel={ticking ? `Ask about ${s.name} too, ${price}` : `${s.name}, ${price}`}
            onPress={() => (ticking ? onToggle(s) : onOpen?.(s))}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: theme.spacing[3],
              padding: theme.spacing[3],
              borderRadius: theme.radii.lg,
              borderWidth: on ? 2 : 1,
              borderColor: on ? theme.colors.brand : theme.colors.separator,
              backgroundColor: theme.colors.surface,
            }}
          >
            <View style={{ flex: 1 }}>
              <AppText variant="label" style={{ color: theme.colors.textPrimary }}>{s.name}</AppText>
              <AppText variant="caption" style={{ color: theme.colors.textMuted }}>{price}</AppText>
            </View>
            <Icon name={ticking ? (on ? 'check' : 'plus') : 'chevron-right'} size={18} color={theme.colors.brand} />
          </PressableFeedback>
        );
      })}
    </View>
  );
}
