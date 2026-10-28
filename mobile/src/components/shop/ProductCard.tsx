import { View } from 'react-native';
import { PressableFeedback } from '../common/PressableFeedback';
import { AppText } from '../common/AppText';
import { Photo } from '../common/Photo';
import { Price } from './Price';
import { useTheme } from '../../core/theme/theme-provider';
import type { Product } from '../../types/shop/shop';

const IMAGE_HEIGHT = 150;

/** Design product tile: photo, name, seller, price (with MRP), and a quick "+" to add one to the cart. */
export function ProductCard({ product, onOpen, onAdd }: { product: Product; onOpen: () => void; onAdd: () => void }) {
  const theme = useTheme();
  const out = product.stock === 0;
  return (
    <PressableFeedback accessibilityRole="button" accessibilityLabel={`${product.name}, ${product.seller.business_name}`} onPress={onOpen} style={{ flex: 1, gap: 6 }}>
      <View>
        {product.photos[0] ? <Photo uri={product.photos[0].url} style={{ width: '100%', height: IMAGE_HEIGHT, borderRadius: theme.radii.md }} /> : null}
        <PressableFeedback
          accessibilityRole="button"
          accessibilityLabel={out ? `${product.name} is out of stock` : `Add ${product.name} to cart`}
          accessibilityState={{ disabled: out }}
          disabled={out}
          onPress={onAdd}
          hitSlop={6}
          style={{ position: 'absolute', right: 8, bottom: 8, width: 32, height: 32, borderRadius: 16, backgroundColor: theme.colors.surface, alignItems: 'center', justifyContent: 'center', opacity: out ? 0.5 : 1 }}
        >
          <AppText style={{ fontSize: 18, color: theme.colors.brand }}>+</AppText>
        </PressableFeedback>
      </View>
      <AppText variant="label" numberOfLines={2} style={{ fontSize: 13, color: theme.colors.textPrimary }}>{product.name}</AppText>
      <AppText variant="caption" numberOfLines={1} style={{ color: theme.colors.textMuted }}>{product.seller.business_name}</AppText>
      {out ? <AppText variant="caption" style={{ color: theme.colors.error }}>Out of stock</AppText> : <Price price={product.price_paise} mrp={product.mrp_paise} />}
    </PressableFeedback>
  );
}
