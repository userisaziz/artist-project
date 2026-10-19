import { View } from 'react-native';
import { AppText } from '../common/AppText';
import { useTheme } from '../../core/theme/theme-provider';
import { formatPrice } from '../../utils/common/format';

/** The price, with the struck-through MRP and the discount when there is one. */
export function Price({ price, mrp, discount, size = 'md' }: { price: number; mrp: number | null; discount?: number | null; size?: 'md' | 'lg' }) {
  const theme = useTheme();
  const big = size === 'lg';
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
      <AppText variant="subtitle" style={{ fontSize: big ? 22 : 14, color: theme.colors.textPrimary }}>{formatPrice(price)}</AppText>
      {mrp && mrp > price ? (
        <AppText variant="caption" style={{ color: theme.colors.textMuted, textDecorationLine: 'line-through' }}>{formatPrice(mrp)}</AppText>
      ) : null}
      {big && discount ? (
        <View style={{ borderRadius: theme.radii.pill, backgroundColor: theme.colors.confirmedSoft, paddingHorizontal: 8, paddingVertical: 2 }}>
          <AppText variant="caption" style={{ color: theme.colors.confirmedInk }}>{`${discount}% off`}</AppText>
        </View>
      ) : null}
    </View>
  );
}
