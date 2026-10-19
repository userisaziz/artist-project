import { useState } from 'react';
import { Alert, View } from 'react-native';
import { AppButton } from '../common/AppButton';
import { AppText } from '../common/AppText';
import { AppTextField } from '../common/AppTextField';
import { StatusPill } from '../common/StatusPill';
import { useTheme } from '../../core/theme/theme-provider';
import { errorMessage } from '../../core/api/error-message';
import { useOrderStep } from '../../hooks/shop/shop';
import { METHOD_LABEL, ORDER_STATUS } from '../../utils/shop/cart';
import { formatPrice } from '../../utils/common/format';
import type { Order } from '../../types/shop/shop';

const TRACKING_MAX = 120;

/** One order for the artist: who, what, where, how they'll be paid, and the next step. */
export function ShopOrderCard({ order: o }: { order: Order }) {
  const theme = useTheme();
  const step = useOrderStep();
  const [tracking, setTracking] = useState('');
  const run = (s: Parameters<typeof step.mutate>[0]['step'], body?: { tracking?: string | null; reason?: string | null }) =>
    step.mutate({ order: o, step: s, body }, { onError: (e) => Alert.alert('Couldn’t update the order', errorMessage(e)) });
  const needsPayment = o.payment_method === 'pay_before_shipping' && !o.paid_at;
  const open = o.status === 'placed' || o.status === 'confirmed';

  return (
    <View style={{ borderRadius: theme.radii.card, borderWidth: 1, borderColor: theme.colors.separator, padding: 14, gap: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <AppText variant="label" style={{ flex: 1, color: theme.colors.textPrimary }}>{`#${o.code} · ${o.customer.name}`}</AppText>
        <StatusPill label={ORDER_STATUS[o.status].label} tone={ORDER_STATUS[o.status].tone} />
      </View>
      {o.items.map((i) => <AppText key={`${i.product_id}:${i.name}`} variant="caption" style={{ color: theme.colors.textSecondary }}>{`${i.name} × ${i.quantity}`}</AppText>)}
      <AppText variant="caption" style={{ color: theme.colors.textMuted }}>{`${formatPrice(o.total_paise)} · ${METHOD_LABEL[o.payment_method].title}${o.paid_at ? ' · paid' : ''}`}</AppText>
      <AppText variant="caption" style={{ color: theme.colors.textMuted }}>{`${o.address} · ${o.customer.phone}`}</AppText>
      {o.status === 'placed' ? <AppButton label="Confirm order" loading={step.isPending} onPress={() => run('confirm')} /> : null}
      {o.status === 'confirmed' && needsPayment ? <AppButton label="Mark paid" loading={step.isPending} onPress={() => run('mark-paid')} /> : null}
      {o.status === 'confirmed' && !needsPayment ? (
        <View style={{ gap: 8 }}>
          <AppTextField label="Tracking (optional)" placeholder="Courier and tracking number" value={tracking} onChangeText={setTracking} maxLength={TRACKING_MAX} />
          <AppButton label="Mark shipped" loading={step.isPending} onPress={() => run('ship', { tracking: tracking.trim() || null })} />
        </View>
      ) : null}
      {o.status === 'shipped' ? <AppButton label="Mark delivered" loading={step.isPending} onPress={() => run('deliver')} /> : null}
      {open ? (
        <AppButton
          label="Cancel order"
          variant="ghost"
          disabled={step.isPending}
          onPress={() => Alert.alert('Cancel this order?', 'The customer is told, and the stock comes back.', [
            { text: 'Keep', style: 'cancel' },
            { text: 'Cancel order', style: 'destructive', onPress: () => run('cancel', { reason: null }) },
          ])}
        />
      ) : null}
    </View>
  );
}
