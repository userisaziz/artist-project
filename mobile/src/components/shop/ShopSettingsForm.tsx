import { useState } from 'react';
import { ScrollView, Switch, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppButton } from '../common/AppButton';
import { AppText } from '../common/AppText';
import { AppTextField } from '../common/AppTextField';
import { BackHeader } from '../common/BackHeader';
import { ErrorView, LoadingView } from '../common/StateViews';
import { useTheme } from '../../core/theme/theme-provider';
import { errorMessage } from '../../core/api/error-message';
import { useSaveShopSettings, useShopSettings } from '../../hooks/shop/shop';
import { METHOD_LABEL, rupeesToPaise } from '../../utils/shop/cart';
import type { ShopSettings } from '../../types/shop/shop';

const rupees = (paise: number | null) => (paise ? String(paise / 100) : '');

/** The artist's shop defaults: which payment methods they accept (products can override) and delivery. */
export function ShopSettingsForm({ onSaved }: { onSaved: () => void }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const settings = useShopSettings();
  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.colors.background }} contentContainerStyle={{ paddingTop: insets.top + theme.spacing.sm, paddingHorizontal: theme.spacing.md, paddingBottom: insets.bottom + theme.spacing.xl, gap: 14 }}>
      <BackHeader title="Payment & delivery" />
      {settings.isPending ? <LoadingView /> : null}
      {settings.isError ? <ErrorView error={settings.error} onRetry={() => { void settings.refetch(); }} /> : null}
      {settings.data ? <SettingsFields initial={settings.data} onSaved={onSaved} /> : null}
    </ScrollView>
  );
}

function SettingsFields({ initial, onSaved }: { initial: ShopSettings; onSaved: () => void }) {
  const theme = useTheme();
  const save = useSaveShopSettings();
  const [cod, setCod] = useState(initial.pay_on_delivery);
  const [prepay, setPrepay] = useState(initial.pay_before_shipping);
  const [fee, setFee] = useState(rupees(initial.delivery_fee_paise));
  const [freeOver, setFreeOver] = useState(rupees(initial.free_delivery_over_paise));
  const valid = cod || prepay;
  const row = { flexDirection: 'row', alignItems: 'center', gap: 12 } as const;

  return (
    <>
      <AppText variant="label" style={{ color: theme.colors.textPrimary }}>Payment methods you accept</AppText>
      {[{ key: 'cod', on: cod, set: setCod, m: 'pay_on_delivery' as const }, { key: 'prepay', on: prepay, set: setPrepay, m: 'pay_before_shipping' as const }].map((o) => (
        <View key={o.key} style={row}>
          <View style={{ flex: 1 }}>
            <AppText variant="body" style={{ color: theme.colors.textPrimary }}>{METHOD_LABEL[o.m].title}</AppText>
            <AppText variant="caption" style={{ color: theme.colors.textMuted }}>{METHOD_LABEL[o.m].detail}</AppText>
          </View>
          <Switch accessibilityLabel={METHOD_LABEL[o.m].title} value={o.on} onValueChange={o.set} trackColor={{ true: theme.colors.brand, false: theme.colors.separator }} />
        </View>
      ))}
      {!valid ? <AppText variant="caption" style={{ color: theme.colors.error }}>Accept at least one.</AppText> : null}
      <AppText variant="caption" style={{ color: theme.colors.textMuted }}>Nothing is paid in the app. Each product uses these unless you choose otherwise for it.</AppText>
      <AppTextField label="Delivery charge (₹)" keyboardType="decimal-pad" placeholder="0" value={fee} onChangeText={setFee} />
      <AppTextField label="Free delivery over (₹, optional)" keyboardType="decimal-pad" placeholder="999" value={freeOver} onChangeText={setFreeOver} />
      {save.isError ? <AppText variant="caption" accessibilityRole="alert" style={{ color: theme.colors.error }}>{errorMessage(save.error)}</AppText> : null}
      <AppButton
        label="Save"
        loading={save.isPending}
        disabled={!valid}
        onPress={() =>
          save.mutate(
            {
              pay_on_delivery: cod,
              pay_before_shipping: prepay,
              delivery_fee_paise: fee.trim() ? rupeesToPaise(fee) ?? 0 : 0,
              free_delivery_over_paise: freeOver.trim() ? rupeesToPaise(freeOver) : null,
            },
            { onSuccess: onSaved },
          )
        }
      />
    </>
  );
}
