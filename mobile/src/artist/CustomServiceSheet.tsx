import { useState } from 'react';
import { View } from 'react-native';
import { AppText } from '../components/AppText';
import { AppButton } from '../components/AppButton';
import { AppTextField } from '../components/AppTextField';
import { BottomSheet } from '../components/BottomSheet';
import { Chip } from '../components/Chip';
import { useTheme } from '../theme/theme-provider';
import { errorMessage } from '../api/error-message';
import type { CatalogCategory, CustomServiceInput, ServiceItem } from '../api/types';

const MAX_NAME = 120; // backend CustomServiceIn
const MAX_RUPEES = 1_000_000; // price_paise ≤ 100 000 000
const MAX_MINUTES = 1440;
const MAX_DESCRIPTION = 1000;

interface CustomServiceSheetProps {
  /** The catalog tree (any active subcategory may hold a custom service). */
  categories: CatalogCategory[];
  /** Editing this service; absent when adding. Mount with a `key` per service so the fields start from it. */
  service?: ServiceItem;
  onClose: () => void;
  onSubmit: (input: CustomServiceInput) => Promise<void>;
}

function categoryOf(categories: CatalogCategory[], subId: number | undefined): number | null {
  return categories.find((c) => c.subcategories.some((s) => s.id === subId))?.id ?? null;
}

/**
 * Spec §2.2 "Add a custom service": a subcategory picker from /categories, then name, price, duration and an optional
 * description. Editing reuses it; any edit sends the service back to review, and the sheet says so.
 */
export function CustomServiceSheet({ categories, service, onClose, onSubmit }: CustomServiceSheetProps) {
  const theme = useTheme();
  const withSubs = categories.filter((c) => c.subcategories.length);
  const [categoryId, setCategoryId] = useState<number | null>(categoryOf(withSubs, service?.subcategory_id));
  const [subId, setSubId] = useState<number | null>(service && categoryOf(withSubs, service.subcategory_id) !== null ? service.subcategory_id : null);
  const [name, setName] = useState(service?.name ?? '');
  const [price, setPrice] = useState(service ? String(Math.round(service.price_paise / 100)) : '');
  const [minutes, setMinutes] = useState(service ? String(service.duration_minutes) : '');
  const [description, setDescription] = useState(service?.description ?? '');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const category = withSubs.find((c) => c.id === categoryId) ?? null;

  const pickCategory = (id: number) => {
    const next = withSubs.find((c) => c.id === id);
    setCategoryId(id);
    setSubId(next?.subcategories.length === 1 ? next.subcategories[0].id : null);
  };

  /** The input, or a message for the first problem. */
  const validate = (): CustomServiceInput | string => {
    const rupees = Number(price);
    const mins = Number(minutes);
    if (subId === null) return 'Pick a category and a subcategory.';
    if (!name.trim()) return 'Enter a name for the service.';
    if (!Number.isInteger(rupees) || rupees <= 0 || rupees > MAX_RUPEES) return 'Enter a price above ₹0.';
    if (!Number.isInteger(mins) || mins <= 0 || mins > MAX_MINUTES) return 'Enter a duration between 1 and 1440 minutes.';
    return { subcategory_id: subId, name: name.trim(), price_paise: rupees * 100, duration_minutes: mins, description: description.trim() || null };
  };

  const save = async () => {
    const input = validate();
    if (typeof input === 'string') { setError(input); return; }
    setSaving(true);
    setError(null);
    try {
      await onSubmit(input);
      onClose();
    } catch (e) {
      setError(errorMessage(e));
      setSaving(false);
    }
  };

  return (
    <BottomSheet
      visible
      title={service ? 'Edit service' : 'Add a custom service'}
      onClose={onClose}
      footer={<AppButton label="Send for review" onPress={() => { void save(); }} loading={saving} />}
    >
      <AppText variant="caption" style={{ color: theme.colors.textSecondary, lineHeight: 19 }}>
        {service ? 'Saving sends it back for review.' : 'We check every custom service before it goes live.'}
      </AppText>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {withSubs.map((c) => <Chip key={c.id} label={c.name} selected={categoryId === c.id} onPress={() => pickCategory(c.id)} />)}
      </View>
      {category ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {category.subcategories.map((s) => <Chip key={s.id} label={s.name} selected={subId === s.id} onPress={() => setSubId(s.id)} />)}
        </View>
      ) : null}
      <AppTextField label="Service name" value={name} onChangeText={setName} maxLength={MAX_NAME} placeholder="e.g. Glitter Arabic" />
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}>
          <AppTextField label="Price (₹)" value={price} onChangeText={setPrice} keyboardType="number-pad" placeholder="2500" />
        </View>
        <View style={{ flex: 1 }}>
          <AppTextField label="Duration (minutes)" value={minutes} onChangeText={setMinutes} keyboardType="number-pad" placeholder="60" />
        </View>
      </View>
      <AppTextField label="Description (optional)" value={description} onChangeText={setDescription} maxLength={MAX_DESCRIPTION} placeholder="What's included" />
      {error ? <AppText variant="caption" style={{ color: theme.colors.error }}>{error}</AppText> : null}
    </BottomSheet>
  );
}
