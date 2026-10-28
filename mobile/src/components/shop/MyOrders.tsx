import { FlatList, View } from 'react-native';
import { PressableFeedback } from '../common/PressableFeedback';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '../common/AppText';
import { BackHeader } from '../common/BackHeader';
import { StatusPill } from '../common/StatusPill';
import { EmptyView, ErrorView, LoadingView } from '../common/StateViews';
import { useTheme } from '../../core/theme/theme-provider';
import { useMyOrders } from '../../hooks/shop/shop';
import { ORDER_STATUS } from '../../utils/shop/cart';
import { formatPrice } from '../../utils/common/format';
import { formatDay, istDateKey } from '../../utils/common/time';
import { usePullToRefresh } from '../../hooks/common/use-pull-to-refresh';

/** Design "My orders": each order with its artist, items, total and where it stands. */
export function MyOrders({ onOpen }: { onOpen: (id: string) => void }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const orders = useMyOrders();
  const pull = usePullToRefresh(orders.refetch);
  const items = orders.data?.pages.flatMap((p) => p.items) ?? [];
  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background, paddingTop: insets.top + theme.spacing.sm, paddingHorizontal: theme.spacing.md }}>
      <BackHeader title="My orders" />
      {orders.isPending ? <LoadingView label="Loading your orders" /> : null}
      {orders.isError && !orders.data ? <ErrorView error={orders.error} onRetry={() => { void orders.refetch(); }} /> : null}
      {orders.isSuccess && !items.length ? <EmptyView message="No orders yet." /> : null}
      <FlatList
        refreshing={pull.refreshing}
        onRefresh={pull.onRefresh}
        data={items}
        keyExtractor={(o) => o.id}
        contentContainerStyle={{ paddingVertical: 12, gap: 10, paddingBottom: insets.bottom + theme.spacing.xl }}
        onEndReached={() => { if (orders.hasNextPage && !orders.isFetchingNextPage) void orders.fetchNextPage(); }}
        renderItem={({ item: o }) => (
          <PressableFeedback accessibilityRole="button" accessibilityLabel={`Order ${o.code}, ${ORDER_STATUS[o.status].label}`} onPress={() => onOpen(o.id)} style={{ borderRadius: theme.radii.card, borderWidth: 1, borderColor: theme.colors.separator, padding: 14, gap: 6 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <AppText variant="label" style={{ flex: 1, color: theme.colors.textPrimary }}>{`#${o.code} · ${formatDay(istDateKey(o.created_at))}`}</AppText>
              <StatusPill label={ORDER_STATUS[o.status].label} tone={ORDER_STATUS[o.status].tone} />
            </View>
            <AppText variant="caption" style={{ color: theme.colors.textMuted }}>{`${o.seller.business_name} · ${o.items.reduce((n, i) => n + i.quantity, 0)} items · ${formatPrice(o.total_paise)}`}</AppText>
          </PressableFeedback>
        )}
      />
    </View>
  );
}
