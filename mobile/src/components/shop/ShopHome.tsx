import { useState } from 'react';
import { FlatList, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '../common/AppText';
import { AppTextField } from '../common/AppTextField';
import { Chip } from '../common/Chip';
import { EmptyView, ErrorView, LoadingView } from '../common/StateViews';
import { ProductCard } from './ProductCard';
import { useTheme } from '../../core/theme/theme-provider';
import { useCart } from '../../context/shop/cart-context';
import { useDebouncedValue } from '../../hooks/common/use-debounced-value';
import { useProducts } from '../../hooks/shop/shop';
import { cartCount } from '../../utils/shop/cart';
import type { ShopCategory } from '../../types/shop/shop';
import { Icon } from '../common/Icon';

const CATEGORIES: { key: ShopCategory | null; label: string }[] = [
  { key: null, label: 'All' },
  { key: 'henna', label: 'Henna & aftercare' },
  { key: 'makeup', label: 'Makeup' },
  { key: 'hair', label: 'Hair accessories' },
  { key: 'prints', label: 'Prints & decor' },
];

/** Design "Shop": search, category chips and a grid of products made by artists. */
export function ShopHome({ onOpenProduct, onOpenCart }: { onOpenProduct: (id: string) => void; onOpenCart: () => void }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const cart = useCart();
  const [category, setCategory] = useState<ShopCategory | null>(null);
  const [query, setQuery] = useState('');
  const q = useDebouncedValue(query.trim());
  const products = useProducts(category, q);
  const items = products.data?.pages.flatMap((p) => p.items) ?? [];
  const inCart = cartCount(cart.lines);

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background, paddingTop: insets.top + theme.spacing.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: theme.spacing.md }}>
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <AppText variant="display" style={{ fontSize: 30, lineHeight: 34, color: theme.colors.heading }}>Shop</AppText>
          <Icon name="sparkles" size={20} color={theme.colors.brand} />
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel={inCart ? `Cart, ${inCart} items` : 'Cart, empty'} onPress={onOpenCart} hitSlop={8} style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: theme.radii.pill, borderWidth: 1, borderColor: theme.colors.separator }}>
          <AppText variant="label" style={{ color: theme.colors.textPrimary }}>{`Cart${inCart ? ` · ${inCart}` : ''}`}</AppText>
        </Pressable>
      </View>
      <View style={{ paddingHorizontal: theme.spacing.md, marginTop: 12 }}>
        <AppTextField label="Search the shop" hideLabel placeholder="Search henna, makeup, accessories" value={query} onChangeText={setQuery} autoCorrect={false} />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ gap: 8, paddingHorizontal: theme.spacing.md, paddingVertical: 12 }}>
        {CATEGORIES.map((c) => <Chip key={c.label} label={c.label} selected={category === c.key} onPress={() => setCategory(c.key)} />)}
      </ScrollView>
      {products.isPending ? <LoadingView label="Loading the shop" /> : null}
      {products.isError && !products.data ? <ErrorView error={products.error} onRetry={() => { void products.refetch(); }} /> : null}
      {products.isSuccess && !items.length ? <EmptyView message={q ? `Nothing matches “${q}”.` : 'No products here yet.'} /> : null}
      {items.length ? (
        <FlatList
          data={items}
          numColumns={2}
          keyExtractor={(p) => p.id}
          columnWrapperStyle={{ gap: 12 }}
          contentContainerStyle={{ gap: 18, paddingHorizontal: theme.spacing.md, paddingBottom: insets.bottom + theme.spacing.xl }}
          renderItem={({ item }) => <ProductCard product={item} onOpen={() => onOpenProduct(item.id)} onAdd={() => cart.add(item)} />}
          onEndReached={() => { if (products.hasNextPage && !products.isFetchingNextPage) void products.fetchNextPage(); }}
        />
      ) : null}
    </View>
  );
}
