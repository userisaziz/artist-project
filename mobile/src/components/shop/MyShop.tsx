import { useState } from 'react';
import { FlatList, Switch, View } from 'react-native';
import { PressableFeedback } from '../common/PressableFeedback';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppButton } from '../common/AppButton';
import { AppText } from '../common/AppText';
import { BackHeader } from '../common/BackHeader';
import { Photo } from '../common/Photo';
import { Segmented } from '../common/Segmented';
import { EmptyView, ErrorView, LoadingView } from '../common/StateViews';
import { ShopOrderCard } from './ShopOrderCard';
import { useTheme } from '../../core/theme/theme-provider';
import { errorMessage } from '../../core/api/error-message';
import { toast } from '../../core/toast/toast';
import { useMyProducts, useShopOrders, useShopSummary, useUpdateProduct } from '../../hooks/shop/shop';
import { formatPrice } from '../../utils/common/format';
import { Icon } from '../common/Icon';

const THUMB = 56;
const LOW_STOCK = 5;

/** Design "My shop" (phase 1): to pack, this month's orders and sales (paid to you directly), products with
 *  an on/off switch, and orders to work through. */
interface MyShopProps { onAddProduct: () => void; onEditProduct: (id: string) => void; onOpenSettings: () => void }

export function MyShop({ onAddProduct, onEditProduct, onOpenSettings }: MyShopProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<'products' | 'orders'>('products');
  const summary = useShopSummary().data;
  const products = useMyProducts();
  const orders = useShopOrders('all');
  const update = useUpdateProduct();
  const productItems = products.data?.pages.flatMap((p) => p.items) ?? [];
  const orderItems = orders.data?.pages.flatMap((p) => p.items) ?? [];
  const list = tab === 'products' ? products : orders;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background, paddingTop: insets.top + theme.spacing.sm, paddingHorizontal: theme.spacing.md }}>
      <BackHeader title="My shop" />
      <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
        <View style={{ flex: 1.4, borderRadius: theme.radii.card, backgroundColor: theme.colors.brandSoft, padding: 14 }}>
          <AppText variant="caption" style={{ color: theme.colors.textMuted }}>Shop sales this month</AppText>
          <AppText variant="display" style={{ fontSize: 24, color: theme.colors.heading }}>{summary ? formatPrice(summary.sales_this_month_paise) : '…'}</AppText>
          <AppText variant="caption" style={{ color: theme.colors.textMuted }}>Paid to you directly</AppText>
        </View>
        <View style={{ flex: 1, borderRadius: theme.radii.card, borderWidth: 1, borderColor: theme.colors.separator, padding: 14 }}>
          <AppText variant="display" style={{ fontSize: 24, color: theme.colors.heading }}>{summary ? String(summary.orders_this_month) : '…'}</AppText>
          <AppText variant="caption" style={{ color: theme.colors.textMuted }}>Orders</AppText>
        </View>
      </View>
      {summary?.to_pack ? (
        <PressableFeedback accessibilityRole="button" onPress={() => setTab('orders')} style={{ marginTop: 10, borderRadius: theme.radii.md, backgroundColor: theme.colors.pendingSoft, padding: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <AppText variant="label" style={{ color: theme.colors.pendingInk }}>{`${summary.to_pack} order${summary.to_pack === 1 ? '' : 's'} to pack`}</AppText>
          <Icon name="chevron-right" size={18} color={theme.colors.pendingInk} />
        </PressableFeedback>
      ) : null}
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
        <View style={{ flex: 1 }}><AppButton label="+ Add product" onPress={onAddProduct} /></View>
        <View style={{ flex: 1 }}><AppButton label="Payment & delivery" variant="secondary" onPress={onOpenSettings} /></View>
      </View>
      <View style={{ marginVertical: 12 }}>
        <Segmented options={[{ key: 'products', label: `Products${summary ? ` · ${summary.products}` : ''}` }, { key: 'orders', label: 'Orders' }]} value={tab} onChange={setTab} />
      </View>
      {list.isPending ? <LoadingView /> : null}
      {list.isError && !list.data ? <ErrorView error={list.error} onRetry={() => { void list.refetch(); }} /> : null}
      {tab === 'products' && products.isSuccess && !productItems.length ? <EmptyView message="List your first product: henna cones, kits, prints." /> : null}
      {tab === 'orders' && orders.isSuccess && !orderItems.length ? <EmptyView message="No orders yet." /> : null}
      {tab === 'products' ? (
        <FlatList
          data={productItems}
          keyExtractor={(p) => p.id}
          contentContainerStyle={{ paddingBottom: insets.bottom + theme.spacing.xl }}
          renderItem={({ item: p }) => (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: theme.colors.separator }}>
              {p.photos[0] ? <Photo uri={p.photos[0].url} style={{ width: THUMB, height: THUMB, borderRadius: theme.radii.sm }} /> : null}
              <PressableFeedback accessibilityRole="button" accessibilityLabel={`Edit ${p.name}`} onPress={() => onEditProduct(p.id)} style={{ flex: 1 }}>
                <AppText variant="label" numberOfLines={1} style={{ color: theme.colors.textPrimary }}>{p.name}</AppText>
                <AppText variant="caption" style={{ color: theme.colors.textMuted }}>{`${p.sold} sold · ${formatPrice(p.price_paise)}`}</AppText>
                <AppText variant="caption" style={{ color: p.status === 'removed' ? theme.colors.error : p.stock <= LOW_STOCK ? theme.colors.pendingInk : theme.colors.confirmedInk }}>
                  {p.status === 'removed' ? `Taken down: ${p.removed_reason ?? 'by our team'}` : p.stock === 0 ? 'Out of stock' : `${p.stock} in stock`}
                </AppText>
              </PressableFeedback>
              <Switch
                accessibilityLabel={`${p.name} on sale`}
                value={p.is_active}
                disabled={p.status === 'removed' || update.isPending}
                onValueChange={(on) => update.mutate({ id: p.id, patch: { is_active: on } }, { onError: (e) => toast('error', 'Couldn’t update', errorMessage(e)) })}
                trackColor={{ true: theme.colors.brand, false: theme.colors.separator }}
              />
            </View>
          )}
        />
      ) : (
        <FlatList data={orderItems} keyExtractor={(o) => o.id} contentContainerStyle={{ gap: 10, paddingBottom: insets.bottom + theme.spacing.xl }} renderItem={({ item }) => <ShopOrderCard order={item} />} />
      )}
    </View>
  );
}
