import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { PressableFeedback } from '../common/PressableFeedback';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '../common/AppText';
import { AppTextField } from '../common/AppTextField';
import { BackHeader } from '../common/BackHeader';
import { ErrorView, LoadingView } from '../common/StateViews';
import { useTheme } from '../../core/theme/theme-provider';
import { errorMessage } from '../../core/api/error-message';
import { useMyProduct, useUpdateProduct } from '../../hooks/shop/shop';
import { paiseToRupeesText, productFieldsProblem, rupeesToPaise } from '../../utils/shop/cart';
import type { Product } from '../../types/shop/shop';

interface EditProductFormProps { productId: string; onDone: () => void }

/** My shop → a product: edit its name, price, MRP, stock and description. Photos and category are set at listing time. */
export function EditProductForm({ productId, onDone }: EditProductFormProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { product, isPending, isError, error, refetch } = useMyProduct(productId);

  if (product) return <ProductFields product={product} onDone={onDone} />;
  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background, paddingTop: insets.top + theme.spacing.sm, paddingHorizontal: theme.spacing.md }}>
      <BackHeader title="Edit product" />
      {isPending ? <LoadingView label="Loading your product" /> : null}
      {isError ? <ErrorView error={error} onRetry={() => { void refetch(); }} /> : null}
      {!isPending && !isError ? <AppText variant="body" style={{ color: theme.colors.textMuted, marginTop: 24 }}>This product is no longer in your shop.</AppText> : null}
    </View>
  );
}

type Editable = Pick<Product, 'name' | 'price_paise' | 'mrp_paise' | 'stock' | 'description'>;

function ProductFields({ product, onDone }: { product: Product; onDone: () => void }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const update = useUpdateProduct();
  const [name, setName] = useState(product.name);
  const [price, setPrice] = useState(paiseToRupeesText(product.price_paise));
  const [mrp, setMrp] = useState(product.mrp_paise === null ? '' : paiseToRupeesText(product.mrp_paise));
  const [stock, setStock] = useState(String(product.stock));
  const [description, setDescription] = useState(product.description ?? '');
  const [saveError, setSaveError] = useState<string | null>(null);
  const problem = productFieldsProblem({ name, price, mrp, stock });

  /** Only what changed, so saving a price never overwrites a stock change an order made meanwhile. */
  const changes = (): Partial<Editable> => {
    const next: Editable = {
      name: name.trim(),
      price_paise: rupeesToPaise(price) ?? product.price_paise,
      mrp_paise: mrp.trim() ? rupeesToPaise(mrp) : null,
      stock: Number(stock),
      description: description.trim() || null,
    };
    const keys = Object.keys(next) as (keyof Editable)[];
    return Object.fromEntries(keys.filter((k) => next[k] !== product[k]).map((k) => [k, next[k]]));
  };

  const save = () => {
    if (problem || update.isPending) return;
    const patch = changes();
    if (!Object.keys(patch).length) { onDone(); return; }
    setSaveError(null);
    update.mutate({ id: product.id, patch }, { onSuccess: onDone, onError: (e) => setSaveError(errorMessage(e)) });
  };

  const blocked = !!problem || update.isPending;
  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, backgroundColor: theme.colors.background, paddingTop: insets.top + theme.spacing.sm }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: theme.spacing.md, paddingBottom: 10 }}>
        <PressableFeedback accessibilityRole="button" onPress={onDone} disabled={update.isPending} hitSlop={8}>
          <AppText variant="label" style={{ color: theme.colors.textSecondary }}>Cancel</AppText>
        </PressableFeedback>
        <AppText variant="subtitle" style={{ color: theme.colors.textPrimary }}>Edit product</AppText>
        <PressableFeedback accessibilityRole="button" accessibilityState={{ disabled: blocked }} disabled={blocked} onPress={save} hitSlop={8}>
          <AppText variant="label" style={{ color: blocked ? theme.colors.textMuted : theme.colors.brand }}>{update.isPending ? 'Saving…' : 'Save'}</AppText>
        </PressableFeedback>
      </View>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: theme.spacing.md, gap: 14, paddingBottom: insets.bottom + theme.spacing.xl }}>
        <AppTextField label="Name" value={name} onChangeText={setName} maxLength={120} />
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1 }}><AppTextField label="Price (₹)" keyboardType="decimal-pad" value={price} onChangeText={setPrice} /></View>
          <View style={{ flex: 1 }}><AppTextField label="MRP (optional)" keyboardType="decimal-pad" value={mrp} onChangeText={setMrp} /></View>
        </View>
        <AppTextField label="Stock" keyboardType="number-pad" value={stock} onChangeText={setStock} />
        <AppTextField label="Description (optional)" value={description} onChangeText={setDescription} multiline maxLength={4000} />
        {saveError ? <AppText variant="caption" accessibilityRole="alert" style={{ color: theme.colors.error }}>{saveError}</AppText> : null}
        {!saveError && problem ? <AppText variant="caption" style={{ color: theme.colors.textMuted }}>{problem}</AppText> : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
