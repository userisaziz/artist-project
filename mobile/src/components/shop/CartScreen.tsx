import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppButton } from '../common/AppButton';
import { AppText } from '../common/AppText';
import { BackHeader } from '../common/BackHeader';
import { EmptyView } from '../common/StateViews';
import { Photo } from '../common/Photo';
import { QuantityStepper } from './QuantityStepper';
import { useTheme } from '../../core/theme/theme-provider';
import { useCart } from '../../context/shop/cart-context';
import { MAX_QUANTITY, cartCount, cartTotal, groupBySeller } from '../../utils/shop/cart';
import { formatPrice } from '../../utils/common/format';

const THUMB = 60;

/** Design "Cart": items grouped by the artist who ships them, quantity steppers, the total, and Checkout. */
export function CartScreen({ onCheckout }: { onCheckout: () => void }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const cart = useCart();
  const groups = groupBySeller(cart.lines);
  const count = cartCount(cart.lines);

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + theme.spacing.sm, paddingHorizontal: theme.spacing.md, paddingBottom: insets.bottom + 110, gap: 14 }}>
        <BackHeader title="Cart" step={count ? `${count} item${count === 1 ? '' : 's'}` : undefined} />
        {!count ? <EmptyView message="Your cart is empty." /> : null}
        {groups.map((g) => (
          <View key={g.seller.id} style={{ gap: 10, borderRadius: theme.radii.card, borderWidth: 1, borderColor: theme.colors.separator, padding: 12 }}>
            <AppText variant="label" style={{ color: theme.colors.textMuted }}>{`Shipped by ${g.seller.business_name}`}</AppText>
            {g.lines.map((l) => (
              <View key={l.product.id} style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                {l.product.photos[0] ? <Photo uri={l.product.photos[0].url} style={{ width: THUMB, height: THUMB, borderRadius: theme.radii.sm }} /> : null}
                <View style={{ flex: 1, gap: 4 }}>
                  <AppText variant="label" numberOfLines={2} style={{ color: theme.colors.textPrimary }}>{l.product.name}</AppText>
                  <AppText variant="caption" style={{ color: theme.colors.textMuted }}>{formatPrice(l.product.price_paise)}</AppText>
                </View>
                <QuantityStepper name={l.product.name} quantity={l.quantity} max={Math.min(l.product.stock, MAX_QUANTITY)} onChange={(q) => cart.setQuantity(l.product.id, q)} />
              </View>
            ))}
          </View>
        ))}
        {count ? <AppText variant="caption" style={{ color: theme.colors.textMuted }}>Each artist adds their own delivery charge, shown before you place the order.</AppText> : null}
      </ScrollView>
      {count ? (
        <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: theme.spacing.md, paddingTop: 12, paddingBottom: insets.bottom + 12, backgroundColor: theme.colors.surface, borderTopWidth: 1, borderTopColor: theme.colors.separator }}>
          <View style={{ flex: 1 }}>
            <AppText variant="caption" style={{ color: theme.colors.textMuted }}>Items</AppText>
            <AppText variant="subtitle" style={{ color: theme.colors.textPrimary }}>{formatPrice(cartTotal(cart.lines))}</AppText>
          </View>
          <View style={{ flex: 1.3 }}><AppButton label="Checkout" onPress={onCheckout} /></View>
        </View>
      ) : null}
    </View>
  );
}
