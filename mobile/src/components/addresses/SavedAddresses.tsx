import { useState } from 'react';
import { Alert, ScrollView, View } from 'react-native';
import { PressableFeedback } from '../common/PressableFeedback';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppButton } from '../common/AppButton';
import { AppText } from '../common/AppText';
import { AppTextField } from '../common/AppTextField';
import { BackHeader } from '../common/BackHeader';
import { Card } from '../common/Card';
import { EmptyView, ErrorView, LoadingView } from '../common/StateViews';
import { useTheme } from '../../core/theme/theme-provider';
import { errorMessage } from '../../core/api/error-message';
import { useAddAddress, useAddresses, useDeleteAddress, useUpdateAddress } from '../../hooks/addresses/addresses';
import { ADDRESS_LABEL_MAX, SAVED_ADDRESS_MAX, savedAddressDraftSchema } from '../../utils/addresses/address-draft';
import type { SavedAddress } from '../../types/addresses/addresses';

const MAX_SAVED = 10; // backend MAX_SAVED_ADDRESSES

/** Profile → Saved addresses: rename or delete saved addresses and add new ones; booking and checkout offer them. */
export function SavedAddresses() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const addresses = useAddresses();
  const items = addresses.data ?? [];

  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      contentContainerStyle={{ paddingTop: insets.top + theme.spacing.sm, paddingHorizontal: theme.spacing.md, paddingBottom: insets.bottom + theme.spacing.xl, gap: 14 }}
    >
      <BackHeader title="Saved addresses" />
      {addresses.isPending ? <LoadingView label="Loading your addresses" /> : null}
      {addresses.isError && !addresses.data ? <ErrorView error={addresses.error} onRetry={() => { void addresses.refetch(); }} /> : null}
      {addresses.isSuccess && !items.length ? <EmptyView message="No saved addresses yet. Add one here, or save it when you book." /> : null}
      {items.map((a) => <AddressRow key={a.id} address={a} />)}
      {addresses.isSuccess && items.length < MAX_SAVED ? <NewAddress first={!items.length} /> : null}
    </ScrollView>
  );
}

function AddressRow({ address }: { address: SavedAddress }) {
  const theme = useTheme();
  const update = useUpdateAddress();
  const remove = useDeleteAddress();
  const [label, setLabel] = useState(address.label);
  const renamed = label.trim() && label.trim() !== address.label;

  const confirmDelete = () =>
    Alert.alert(`Delete “${address.label}”?`, address.address, [
      { text: 'Keep', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => remove.mutate(address.id, { onError: (e) => Alert.alert('Couldn’t delete', errorMessage(e)) }) },
    ]);

  return (
    <Card style={{ gap: 8 }}>
      <AppTextField label="Label" value={label} onChangeText={setLabel} maxLength={ADDRESS_LABEL_MAX} />
      <AppText variant="body" style={{ color: theme.colors.textSecondary }}>{address.address}</AppText>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <PressableFeedback accessibilityRole="button" accessibilityLabel={`Delete ${address.label}`} onPress={confirmDelete} hitSlop={8}>
          <AppText variant="label" style={{ color: theme.colors.error }}>Delete</AppText>
        </PressableFeedback>
        {renamed ? (
          <AppButton label="Save label" variant="secondary" loading={update.isPending} onPress={() => update.mutate({ id: address.id, body: { label: label.trim() } })} />
        ) : null}
      </View>
      {update.isError ? <AppText variant="caption" accessibilityRole="alert" style={{ color: theme.colors.error }}>{errorMessage(update.error)}</AppText> : null}
    </Card>
  );
}

function NewAddress({ first }: { first: boolean }) {
  const theme = useTheme();
  const add = useAddAddress();
  const [label, setLabel] = useState(first ? 'Home' : '');
  const [text, setText] = useState('');
  const draft = savedAddressDraftSchema.safeParse({ label, address: text });
  const missing = draft.success ? null : draft.error.issues[0].message;

  const save = () => {
    if (!draft.success || add.isPending) return;
    add.mutate(draft.data, { onSuccess: () => { setLabel(''); setText(''); } });
  };

  return (
    <View style={{ gap: 10, marginTop: 8 }}>
      <AppText variant="title" style={{ color: theme.colors.heading }}>Add an address</AppText>
      <AppTextField label="Label (e.g. Home, Work)" value={label} onChangeText={setLabel} maxLength={ADDRESS_LABEL_MAX} />
      <AppTextField label="Address" placeholder="Flat, building, street, area, city, PIN" value={text} onChangeText={setText} maxLength={SAVED_ADDRESS_MAX} multiline />
      <AppButton label="Save address" loading={add.isPending} disabled={!draft.success} onPress={save} />
      {missing ? <AppText variant="caption" style={{ color: theme.colors.textMuted }}>{missing}</AppText> : null}
      {add.isError ? <AppText variant="caption" accessibilityRole="alert" style={{ color: theme.colors.error }}>{errorMessage(add.error)}</AppText> : null}
    </View>
  );
}
