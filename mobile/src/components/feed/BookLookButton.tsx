import { PressableFeedback } from '../common/PressableFeedback';
import { AppText } from '../common/AppText';
import { useTheme } from '../../core/theme/theme-provider';
import { formatPrice } from '../../utils/common/format';
import type { Post } from '../../types/feed/feed';
import { Icon } from '../common/Icon';

/** Prototype "Book this look" pill (sparkles, the service and its starting price, a chevron): opens Date & time. */
export function BookLookButton({ service, onPress }: { service: NonNullable<Post['service']>; onPress: () => void }) {
  const theme = useTheme();
  return (
    <PressableFeedback
      accessibilityRole="button"
      accessibilityLabel={`Book this look: ${service.name}, from ${formatPrice(service.price_paise)}`}
      onPress={onPress}
      style={{ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: theme.radii.pill, backgroundColor: theme.colors.brandSoft, paddingHorizontal: 12, paddingVertical: 7 }}
    >
      <Icon name="sparkles" size={14} color={theme.colors.brand} />
      <AppText variant="label" style={{ fontSize: 12.5, color: theme.colors.brand }}>{`${service.name} · from ${formatPrice(service.price_paise)}`}</AppText>
      <Icon name="chevron-right" size={14} color={theme.colors.brand} />
    </PressableFeedback>
  );
}
