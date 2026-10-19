import { ScrollView, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppButton } from '../common/AppButton';
import { AppText } from '../common/AppText';
import { Avatar } from '../common/Avatar';
import { BackHeader } from '../common/BackHeader';
import { Photo } from '../common/Photo';
import { ErrorView, LoadingView } from '../common/StateViews';
import { Price } from './Price';
import { useTheme } from '../../core/theme/theme-provider';
import { useCart } from '../../context/shop/cart-context';
import { useProduct } from '../../hooks/shop/shop';
import { METHOD_LABEL } from '../../utils/shop/cart';
import { formatPrice } from '../../utils/common/format';
import { Icon } from '../common/Icon';

const LOW_STOCK = 5;

/** Design product page: photos, seller, name, price with MRP and discount, stock, how to pay, details,
 *  and "Add to cart" / "Buy now". */
export function ProductDetail({ productId, onOpenCart, onCheckout }: { productId: string; onOpenCart: () => void; onCheckout: () => void }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const cart = useCart();
  const product = useProduct(productId);
  const p = product.data;

  if (!p) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background, paddingTop: insets.top + theme.spacing.sm, paddingHorizontal: theme.spacing.md }}>
        <BackHeader />
        {product.isError ? <ErrorView error={product.error} onRetry={() => { void product.refetch(); }} /> : <LoadingView label="Loading the product" />}
      </View>
    );
  }
  const out = p.stock === 0;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 110 }}>
        <View style={{ paddingTop: insets.top + theme.spacing.sm, paddingHorizontal: theme.spacing.md }}><BackHeader /></View>
        <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
          {p.photos.map((ph, i) => <Photo key={`${ph.url}:${i}`} uri={ph.url} label={`${p.name}, photo ${i + 1}`} style={{ width, height: width }} />)}
        </ScrollView>
        <View style={{ padding: theme.spacing.md, gap: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Avatar uri={p.seller.photo_url} name={p.seller.business_name} size={28} />
            <AppText variant="label" style={{ color: theme.colors.textPrimary }}>{p.seller.business_name}</AppText>
            <Icon name="verified" size={16} color={theme.colors.brand} label="Verified artist" />
          </View>
          <AppText variant="display" style={{ fontSize: 26, lineHeight: 30, color: theme.colors.heading }}>{p.name}</AppText>
          <AppText variant="caption" style={{ color: theme.colors.textMuted }}>{`${p.category_label} · ${p.sold} sold · ships from ${p.seller.city}`}</AppText>
          <Price price={p.price_paise} mrp={p.mrp_paise} discount={p.discount_percent} size="lg" />
          <AppText variant="caption" style={{ color: out ? theme.colors.error : p.stock <= LOW_STOCK ? theme.colors.pendingInk : theme.colors.confirmedInk }}>
            {out ? 'Out of stock' : p.stock <= LOW_STOCK ? `Only ${p.stock} left` : 'In stock'}
          </AppText>
          <View style={{ borderRadius: theme.radii.md, backgroundColor: theme.colors.brandSoft, padding: 12, gap: 4 }}>
            <AppText variant="label" style={{ color: theme.colors.textPrimary }}>How you can pay</AppText>
            {p.payment_methods.map((m) => <AppText key={m} variant="caption" style={{ color: theme.colors.textSecondary }}>{`${METHOD_LABEL[m].title}: ${METHOD_LABEL[m].detail}`}</AppText>)}
            <AppText variant="caption" style={{ color: theme.colors.textMuted }}>Nothing is paid in the app.</AppText>
          </View>
          {p.description ? (
            <>
              <AppText variant="subtitle" style={{ color: theme.colors.textPrimary, marginTop: 6 }}>Details</AppText>
              <AppText variant="body" style={{ color: theme.colors.textSecondary }}>{p.description}</AppText>
            </>
          ) : null}
        </View>
      </ScrollView>
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', gap: 8, paddingHorizontal: theme.spacing.md, paddingTop: 12, paddingBottom: insets.bottom + 12, backgroundColor: theme.colors.surface, borderTopWidth: 1, borderTopColor: theme.colors.separator }}>
        <View style={{ flex: 1 }}><AppButton label="Add to cart" variant="secondary" disabled={out} onPress={() => { cart.add(p); onOpenCart(); }} /></View>
        <View style={{ flex: 1.2 }}><AppButton label={`Buy now · ${formatPrice(p.price_paise)}`} disabled={out} onPress={() => { cart.add(p); onCheckout(); }} /></View>
      </View>
    </View>
  );
}
