import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { PressableFeedback } from '../common/PressableFeedback';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '../common/AppText';
import { AppTextField } from '../common/AppTextField';
import { Chip } from '../common/Chip';
import { Photo } from '../common/Photo';
import { useTheme } from '../../core/theme/theme-provider';
import { errorMessage } from '../../core/api/error-message';
import { pickImages, uploadImage, type PickedImage } from '../../api/artist-onboarding/upload';
import { useCreateProduct } from '../../hooks/shop/shop';
import { METHOD_LABEL, productFieldsProblem, rupeesToPaise } from '../../utils/shop/cart';
import type { PaymentMethod, ShopCategory } from '../../types/shop/shop';

const MAX_PHOTOS = 8;
const TILE = 88;
const CATEGORIES: { key: ShopCategory; label: string }[] = [
  { key: 'henna', label: 'Henna & aftercare' },
  { key: 'makeup', label: 'Makeup' },
  { key: 'hair', label: 'Hair accessories' },
  { key: 'prints', label: 'Prints & decor' },
];
const METHODS: PaymentMethod[] = ['pay_on_delivery', 'pay_before_shipping'];

/** Design "New product" (phase 1: physical products): photos, name, price and optional MRP, stock, category,
 *  description, and how this product can be paid for (your shop default unless you choose). */
export function ProductForm({ onCancel, onSaved }: { onCancel: () => void; onSaved: () => void }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const create = useCreateProduct();
  const [photos, setPhotos] = useState<PickedImage[]>([]);
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [mrp, setMrp] = useState('');
  const [stock, setStock] = useState('10');
  const [category, setCategory] = useState<ShopCategory>('henna');
  const [description, setDescription] = useState('');
  const [methods, setMethods] = useState<PaymentMethod[] | null>(null); // null: the shop default
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);
  const pricePaise = rupeesToPaise(price);
  const mrpPaise = mrp.trim() ? rupeesToPaise(mrp) : null;
  const stockCount = Number(stock);
  const missing =
    (!photos.length && 'Add at least one photo') ||
    productFieldsProblem({ name, price, mrp, stock }) ||
    (methods !== null && !methods.length && 'Pick at least one way to pay');

  const toggleMethod = (m: PaymentMethod) =>
    setMethods((current) => {
      const base = current ?? [];
      return base.includes(m) ? base.filter((x) => x !== m) : [...base, m];
    });

  const publish = async () => {
    if (missing || inFlight.current || !pricePaise) return;
    inFlight.current = true;
    setError(null);
    try {
      const uploaded = [];
      for (const [i, image] of photos.entries()) {
        setProgress(`Uploading ${i + 1} of ${photos.length}…`);
        uploaded.push(await uploadImage(image, 'shop'));
      }
      setProgress('Publishing…');
      await create.mutateAsync({
        name: name.trim(),
        description: description.trim() || null,
        category,
        price_paise: pricePaise,
        mrp_paise: mrpPaise,
        stock: stockCount,
        photos: uploaded,
        payment_methods: methods,
      });
      onSaved();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      inFlight.current = false;
      setProgress(null);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, backgroundColor: theme.colors.background, paddingTop: insets.top + theme.spacing.sm }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: theme.spacing.md, paddingBottom: 10 }}>
        <PressableFeedback accessibilityRole="button" onPress={onCancel} disabled={!!progress} hitSlop={8}>
          <AppText variant="label" style={{ color: theme.colors.textSecondary }}>Cancel</AppText>
        </PressableFeedback>
        <AppText variant="subtitle" style={{ color: theme.colors.textPrimary }}>New product</AppText>
        <PressableFeedback accessibilityRole="button" accessibilityState={{ disabled: !!missing || !!progress }} disabled={!!missing || !!progress} onPress={() => { void publish(); }} hitSlop={8}>
          <AppText variant="label" style={{ color: missing || progress ? theme.colors.textMuted : theme.colors.brand }}>Publish</AppText>
        </PressableFeedback>
      </View>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: theme.spacing.md, gap: 14, paddingBottom: insets.bottom + theme.spacing.xl }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {photos.map((p, i) => (
            <PressableFeedback key={`${p.uri}:${i}`} accessibilityRole="button" accessibilityLabel={`Remove photo ${i + 1}`} onPress={() => setPhotos((all) => all.filter((_, j) => j !== i))}>
              <Photo uri={p.uri} style={{ width: TILE, height: TILE, borderRadius: theme.radii.md }} />
            </PressableFeedback>
          ))}
          {photos.length < MAX_PHOTOS ? (
            <PressableFeedback
              accessibilityRole="button"
              accessibilityLabel="Add photos"
              onPress={() => { void pickImages(MAX_PHOTOS - photos.length).then((picked) => setPhotos((all) => [...all, ...picked].slice(0, MAX_PHOTOS))).catch((e: unknown) => setError(errorMessage(e))); }}
              style={{ width: TILE, height: TILE, borderRadius: theme.radii.md, borderWidth: 1, borderStyle: 'dashed', borderColor: theme.colors.border, alignItems: 'center', justifyContent: 'center' }}
            >
              <AppText variant="caption" style={{ color: theme.colors.textMuted }}>+ Photos</AppText>
            </PressableFeedback>
          ) : null}
        </ScrollView>
        <AppTextField label="Name" placeholder="Bridal mehendi starter kit" value={name} onChangeText={setName} maxLength={120} />
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1 }}><AppTextField label="Price (₹)" keyboardType="decimal-pad" placeholder="1200" value={price} onChangeText={setPrice} /></View>
          <View style={{ flex: 1 }}><AppTextField label="MRP (optional)" keyboardType="decimal-pad" placeholder="1500" value={mrp} onChangeText={setMrp} /></View>
        </View>
        <AppTextField label="Stock" keyboardType="number-pad" value={stock} onChangeText={setStock} />
        <AppText variant="label" style={{ color: theme.colors.textPrimary }}>Category</AppText>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {CATEGORIES.map((c) => <Chip key={c.key} label={c.label} selected={category === c.key} onPress={() => setCategory(c.key)} />)}
        </View>
        <AppTextField label="Description (optional)" placeholder="What’s in it, how to use it" value={description} onChangeText={setDescription} multiline maxLength={4000} />
        <AppText variant="label" style={{ color: theme.colors.textPrimary }}>How customers can pay</AppText>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          <Chip label="My shop default" selected={methods === null} onPress={() => setMethods(null)} />
          {METHODS.map((m) => <Chip key={m} label={METHOD_LABEL[m].title} selected={!!methods?.includes(m)} onPress={() => toggleMethod(m)} />)}
        </View>
        {progress ? <AppText variant="caption" accessibilityLiveRegion="polite" style={{ color: theme.colors.textSecondary }}>{progress}</AppText> : null}
        {error ? <AppText variant="caption" accessibilityRole="alert" style={{ color: theme.colors.error }}>{error}</AppText> : null}
        {!error && missing ? <AppText variant="caption" style={{ color: theme.colors.textMuted }}>{missing}</AppText> : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
