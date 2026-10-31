import { AddressPicker, type AddressBook } from '../common/AddressPicker';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { PressableFeedback } from '../common/PressableFeedback';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppButton } from '../common/AppButton';
import { AppText } from '../common/AppText';
import { AppTextField } from '../common/AppTextField';
import { BackHeader } from '../common/BackHeader';
import { EmptyView } from '../common/StateViews';
import { KeyboardAvoider } from '../common/KeyboardAvoider';
import { useTheme } from '../../core/theme/theme-provider';
import { errorMessage } from '../../core/api/error-message';
import { useCart } from '../../context/shop/cart-context';
import { usePlaceOrder } from '../../hooks/shop/shop';
import { METHOD_LABEL, groupBySeller } from '../../utils/shop/cart';
import { formatPrice } from '../../utils/common/format';
import type { Order, PaymentMethod } from '../../types/shop/shop';

const ADDRESS_MIN = 10;
const ADDRESS_MAX = 300;

/** Design "Checkout", phase 1: the address, then for each artist how you'll pay them (from what they accept).
 *  Nothing is paid in the app; delivery charges are added per artist on the order. */
interface CheckoutScreenProps { onPlaced: (orders: Order[]) => void; addressBook?: AddressBook }

export function CheckoutScreen({ onPlaced, addressBook }: CheckoutScreenProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const cart = useCart();
  const place = usePlaceOrder();
  const groups = groupBySeller(cart.lines);
  const [address, setAddress] = useState('');
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [remember, setRemember] = useState(true);
  const [chosen, setChosen] = useState<Record<string, PaymentMethod>>({});
  const methodFor = (sellerId: string, methods: PaymentMethod[]) => chosen[sellerId] ?? (methods.length === 1 ? methods[0] : undefined);
  const unpayable = groups.find((g) => g.methods.length === 0);
  const ready = address.trim().length >= ADDRESS_MIN && !unpayable && groups.every((g) => methodFor(g.seller.id, g.methods)) && groups.length > 0;

  const submit = () => {
    if (!ready || place.isPending) return;
    place.mutate(
      {
        items: cart.lines.map((l) => ({ product_id: l.product.id, quantity: l.quantity })),
        address: address.trim(),
        payment_methods: Object.fromEntries(groups.map((g) => [g.seller.id, methodFor(g.seller.id, g.methods) as PaymentMethod])),
      },
      { onSuccess: (orders) => { addressBook?.afterUse(address, pickedId, remember); cart.clear(); onPlaced(orders); } },
    );
  };

  if (!groups.length) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background, paddingTop: insets.top + theme.spacing.sm, paddingHorizontal: theme.spacing.md }}>
        <BackHeader title="Checkout" />
        <EmptyView message="Your cart is empty." />
      </View>
    );
  }

  return (
    <KeyboardAvoider style={{ backgroundColor: theme.colors.background }}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingTop: insets.top + theme.spacing.sm, paddingHorizontal: theme.spacing.md, paddingBottom: insets.bottom + 120, gap: 16 }}>
        <BackHeader title="Checkout" />
        {addressBook ? (
          <AddressPicker
            choices={addressBook.choices}
            pickedId={pickedId}
            onPick={(c) => { setPickedId(c.id); setAddress(c.address); }}
            remember={remember}
            onRememberChange={setRemember}
          />
        ) : null}
        <AppTextField label="Deliver to" placeholder="Flat, building, street, area, city, PIN" value={address} onChangeText={(v) => { setAddress(v); setPickedId(null); }} maxLength={ADDRESS_MAX} multiline />
        {groups.map((g) => (
          <View key={g.seller.id} style={{ gap: 8, borderRadius: theme.radii.card, borderWidth: 1, borderColor: theme.colors.separator, padding: 12 }}>
            <AppText variant="subtitle" style={{ color: theme.colors.textPrimary }}>{g.seller.business_name}</AppText>
            <AppText variant="caption" style={{ color: theme.colors.textMuted }}>{`${g.lines.length} item${g.lines.length === 1 ? '' : 's'} · ${formatPrice(g.subtotal_paise)} + delivery`}</AppText>
            {g.methods.length === 0 ? (
              <AppText variant="caption" style={{ color: theme.colors.error }}>These items can’t be paid for the same way. Order them separately.</AppText>
            ) : (
              g.methods.map((m) => {
                const selected = methodFor(g.seller.id, g.methods) === m;
                return (
                  <PressableFeedback
                    key={m}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: selected }}
                    onPress={() => setChosen((c) => ({ ...c, [g.seller.id]: m }))}
                    style={{ flexDirection: 'row', gap: 10, alignItems: 'center', padding: 10, borderRadius: theme.radii.md, borderWidth: 1, borderColor: selected ? theme.colors.brand : theme.colors.separator }}
                  >
                    <View style={{ width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: selected ? theme.colors.brand : theme.colors.border, backgroundColor: selected ? theme.colors.brand : 'transparent' }} />
                    <View style={{ flex: 1 }}>
                      <AppText variant="label" style={{ color: theme.colors.textPrimary }}>{METHOD_LABEL[m].title}</AppText>
                      <AppText variant="caption" style={{ color: theme.colors.textMuted }}>{METHOD_LABEL[m].detail}</AppText>
                    </View>
                  </PressableFeedback>
                );
              })
            )}
          </View>
        ))}
        <AppText variant="caption" style={{ color: theme.colors.textMuted }}>Nothing is paid in the app. Each artist confirms your order and ships it themselves.</AppText>
        {place.isError ? <AppText variant="caption" accessibilityRole="alert" style={{ color: theme.colors.error }}>{errorMessage(place.error)}</AppText> : null}
      </ScrollView>
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: theme.spacing.md, paddingTop: 12, paddingBottom: insets.bottom + 12, backgroundColor: theme.colors.surface, borderTopWidth: 1, borderTopColor: theme.colors.separator }}>
        <AppButton label={groups.length > 1 ? `Place ${groups.length} orders` : 'Place order'} loading={place.isPending} disabled={!ready} onPress={submit} />
      </View>
    </KeyboardAvoider>
  );
}
