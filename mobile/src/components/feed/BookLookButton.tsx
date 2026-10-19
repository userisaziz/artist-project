import { Pressable } from 'react-native';
import { AppText } from '../common/AppText';
import { useTheme } from '../../core/theme/theme-provider';
import { formatPrice } from '../../utils/common/format';
import type { Post } from '../../types/feed/feed';

/** Prototype "✦ Bridal Mehendi · from ₹3,500 ›": the post's linked service, opening Date & time. */
export function BookLookButton({ service, onPress }: { service: NonNullable<Post['service']>; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Book this look: ${service.name}, from ${formatPrice(service.price_paise)}`}
      onPress={onPress}
      style={{ alignSelf: 'flex-start', borderRadius: theme.radii.pill, backgroundColor: theme.colors.brandSoft, paddingHorizontal: 12, paddingVertical: 7 }}
    >
      <AppText variant="label" style={{ fontSize: 12.5, color: theme.colors.brand }}>{`✦ ${service.name} · from ${formatPrice(service.price_paise)} ›`}</AppText>
    </Pressable>
  );
}
