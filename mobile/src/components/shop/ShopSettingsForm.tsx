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
import { METHOD_LABEL } from '../../utils/shop/cart';
import { deliveryDraftSchema } from '../../utils/shop/delivery-draft';
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
  // Parsed on every render: the messages under the fields and the amounts that get saved come from the
  // same run of the schema, and Save stays shut while either field is text that isn't money.
  const delivery = deliveryDraftSchema.safeParse({ fee, freeOver });
  const fieldErrors: Record<string, string[] | undefined> = delivery.success ? {} : delivery.error.flatten().fieldErrors;
  const noMethods = !(cod || prepay);
  const valid = !noMethods && delivery.success;
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
      {noMethods ? <AppText variant="caption" style={{ color: theme.colors.error }}>Accept at least one.</AppText> : null}
      <AppText variant="caption" style={{ color: theme.colors.textMuted }}>Nothing is paid in the app. Each product uses these unless you choose otherwise for it.</AppText>
      <AppTextField label="Delivery charge (₹)" keyboardType="decimal-pad" placeholder="0" value={fee} onChangeText={setFee} error={fieldErrors.fee?.[0] ?? null} />
      <AppTextField label="Free delivery over (₹, optional)" keyboardType="decimal-pad" placeholder="999" value={freeOver} onChangeText={setFreeOver} error={fieldErrors.freeOver?.[0] ?? null} />
      {save.isError ? <AppText variant="caption" accessibilityRole="alert" style={{ color: theme.colors.error }}>{errorMessage(save.error)}</AppText> : null}
      <AppButton
        label="Save"
        loading={save.isPending}
        disabled={!valid}
        onPress={() => {
          if (!delivery.success) return; // Save is shut in this case; this only narrows the parse.
          save.mutate(
            {
              pay_on_delivery: cod,
              pay_before_shipping: prepay,
              ...delivery.data,
            },
            { onSuccess: onSaved },
          );
        }}
      />
    </>
  );
}
