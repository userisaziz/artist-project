import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppButton } from '../common/AppButton';
import { AppText } from '../common/AppText';
import { BackHeader } from '../common/BackHeader';
import { InfoRow } from '../common/InfoRow';
import { StatusPill } from '../common/StatusPill';
import { ErrorView, LoadingView } from '../common/StateViews';
import { useTheme } from '../../core/theme/theme-provider';
import { errorMessage } from '../../core/api/error-message';
import { useCancelOrder, useMyOrder } from '../../hooks/shop/shop';
import { METHOD_LABEL, ORDER_STATUS } from '../../utils/shop/cart';
import { formatPrice } from '../../utils/common/format';
import { formatWhen } from '../../utils/common/time';
import type { OrderStatus } from '../../types/shop/shop';
import { brand } from '../../core/brand/brand';

const STEPS: OrderStatus[] = ['placed', 'confirmed', 'shipped', 'delivered'];

/** Design "Track order": the steps so far, items, payment, address, tracking, and Cancel before it ships. */
export function OrderDetail({ orderId }: { orderId: string }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const order = useMyOrder(orderId);
  const cancel = useCancelOrder(orderId);
  const o = order.data;

  if (!o) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background, paddingTop: insets.top + theme.spacing.sm, paddingHorizontal: theme.spacing.md }}>
        <BackHeader title="Track order" />
        {order.isError ? <ErrorView error={order.error} onRetry={() => { void order.refetch(); }} /> : <LoadingView label="Loading the order" />}
      </View>
    );
  }
  const when = new Map(o.timeline.map((e) => [e.status, e.at]));
  const cancellable = o.status === 'placed' || o.status === 'confirmed';

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.colors.background }} contentContainerStyle={{ paddingTop: insets.top + theme.spacing.sm, paddingHorizontal: theme.spacing.md, paddingBottom: insets.bottom + theme.spacing.xl, gap: 14 }}>
      <BackHeader title="Track order" />
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <AppText variant="subtitle" style={{ flex: 1, color: theme.colors.textPrimary }}>{`#${o.code} · ${o.seller.business_name}`}</AppText>
        <StatusPill label={ORDER_STATUS[o.status].label} tone={ORDER_STATUS[o.status].tone} />
      </View>
      {o.status !== 'cancelled' ? (
        <View accessibilityLabel="Order progress" style={{ gap: 10 }}>
          {STEPS.map((s) => (
            <View key={s} style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
              <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: when.has(s) ? theme.colors.brand : theme.colors.separator }} />
              <AppText variant={o.status === s ? 'label' : 'body'} style={{ flex: 1, color: when.has(s) ? theme.colors.textPrimary : theme.colors.textMuted }}>{ORDER_STATUS[s].label}</AppText>
              <AppText variant="caption" style={{ color: theme.colors.textMuted }}>{when.has(s) ? formatWhen(when.get(s) as string) : ''}</AppText>
            </View>
          ))}
        </View>
      ) : (
        <AppText variant="body" style={{ color: theme.colors.textSecondary }}>{`Cancelled by ${o.cancelled_by === 'customer' ? 'you' : o.cancelled_by === 'artist' ? 'the artist' : brand.name}${o.cancel_reason ? `: ${o.cancel_reason}` : '.'}`}</AppText>
      )}
      {o.tracking ? <InfoRow label="Tracking" value={o.tracking} /> : null}
      <View style={{ borderRadius: theme.radii.card, borderWidth: 1, borderColor: theme.colors.separator, padding: 12 }}>
        {o.items.map((i) => <InfoRow key={`${i.product_id}:${i.name}`} label={`${i.name} × ${i.quantity}`} value={formatPrice(i.unit_price_paise * i.quantity)} />)}
        <InfoRow label="Delivery" value={o.delivery_fee_paise ? formatPrice(o.delivery_fee_paise) : 'Free'} />
        <InfoRow label="To pay" value={formatPrice(o.total_paise)} strong />
      </View>
      <InfoRow label="Payment" value={`${METHOD_LABEL[o.payment_method].title}${o.paid_at ? ' · paid' : ''}`} />
      <InfoRow label="Deliver to" value={o.address} />
      {cancellable ? (
        <AppButton label="Cancel order" variant="secondary" loading={cancel.isPending} onPress={() => cancel.mutate(null)} />
      ) : null}
      {cancel.isError ? <AppText variant="caption" accessibilityRole="alert" style={{ color: theme.colors.error }}>{errorMessage(cancel.error)}</AppText> : null}
    </ScrollView>
  );
}
