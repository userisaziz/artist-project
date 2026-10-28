import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, ScrollView, View } from 'react-native';
import { PressableFeedback } from '../common/PressableFeedback';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '../common/AppText';
import { AppButton } from '../common/AppButton';
import { AppTextField } from '../common/AppTextField';
import { Chip } from '../common/Chip';
import { ServiceExtrasEditor } from '../common/ServiceExtrasEditor';
import { ServicePhotoField, type ServicePhotoDraft } from './ServicePhotoField';
import { useTheme } from '../../core/theme/theme-provider';
import { errorMessage } from '../../core/api/error-message';
import { EMPTY_EXTRAS, extrasInput } from '../../utils/common/service-extras';
import type { ServiceInput } from '../../types/artist-onboarding/artist-onboarding';
import type { CatalogCategory } from '../../types/catalog/catalog';

const MAX_RUPEES = 1_000_000; // backend ServiceIn: price_paise ≤ 100 000 000
const MAX_MINUTES = 1440;

/**
 * Bottom sheet for one service, in three steps (spec §3.1): category and subcategory, a service from
 * the admin's list, then the artist's own price, duration and note. Each step appears once the one above is chosen.
 * `categories` is the catalog tree narrowed to the artist's own categories; `addedIds` are templates already on the menu.
 */
export function AddServiceSheet({ visible, categories, addedIds, onClose, onSubmit }: {
  visible: boolean;
  categories: CatalogCategory[];
  addedIds: number[];
  onClose: () => void;
  onSubmit: (service: ServiceInput) => Promise<void>;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [subId, setSubId] = useState<number | null>(null);
  const [templateId, setTemplateId] = useState<number | null>(null);
  const [price, setPrice] = useState('');
  const [minutes, setMinutes] = useState('');
  const [note, setNote] = useState('');
  const [extras, setExtras] = useState(EMPTY_EXTRAS);
  const [photo, setPhoto] = useState<ServicePhotoDraft>({ url: null });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Each opening starts blank; a single category (and then a single subcategory) is preselected.
  useEffect(() => {
    if (!visible) return;
    const only = categories.length === 1 ? categories[0] : null;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCategoryId(only?.id ?? null);
    setSubId(only?.subcategories.length === 1 ? only.subcategories[0].id : null);
    setTemplateId(null); setPrice(''); setMinutes(''); setNote(''); setExtras(EMPTY_EXTRAS); setPhoto({ url: null }); setError(null);
  }, [visible, categories]);

  const category = categories.find((c) => c.id === categoryId) ?? null;
  const sub = category?.subcategories.find((s) => s.id === subId) ?? null;
  const nothingListed = categories.every((c) => c.subcategories.every((s) => s.services.length === 0));

  const pickCategory = (id: number) => {
    const next = categories.find((c) => c.id === id);
    setCategoryId(id);
    setSubId(next?.subcategories.length === 1 ? next.subcategories[0].id : null);
    setTemplateId(null);
  };
  const pickSub = (id: number) => { setSubId(id); setTemplateId(null); };

  const save = async () => {
    const rupees = Number(price);
    const mins = Number(minutes);
    if (templateId === null) { setError('Pick a service.'); return; }
    if (!Number.isInteger(rupees) || rupees <= 0 || rupees > MAX_RUPEES) { setError('Enter a price above ₹0.'); return; }
    if (!Number.isInteger(mins) || mins <= 0 || mins > MAX_MINUTES) { setError('Enter a duration between 1 and 1440 minutes.'); return; }
    const extra = extrasInput(extras);
    if (!extra.ok) { setError(extra.error); return; }
    setSaving(true);
    setError(null);
    try {
      await onSubmit({
        template_id: templateId, price_paise: rupees * 100, duration_minutes: mins,
        ...(note.trim() ? { description: note.trim() } : {}),
        ...extra.value,
        ...(photo.key ? { photo_key: photo.key } : {}),
      });
      onClose();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <PressableFeedback feedback={false} accessibilityLabel="Close" style={{ flex: 1, backgroundColor: theme.colors.overlay }} onPress={onClose} />
        <View style={{ maxHeight: '85%', backgroundColor: theme.colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: insets.bottom + 16 }}>
          <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 8, gap: 14 }} keyboardShouldPersistTaps="handled">
            <AppText variant="title" style={{ color: theme.colors.heading }}>Add a service</AppText>
            {nothingListed ? (
              <AppText variant="caption" style={{ color: theme.colors.textSecondary, lineHeight: 19 }}>
                Services for your categories are being set up. Check back soon.
              </AppText>
            ) : (
              <>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {categories.map((c) => <Chip key={c.id} label={c.name} selected={categoryId === c.id} onPress={() => pickCategory(c.id)} />)}
                </View>
                {category ? (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    {category.subcategories.map((s) => <Chip key={s.id} label={s.name} selected={subId === s.id} onPress={() => pickSub(s.id)} />)}
                  </View>
                ) : null}
                {sub && !sub.services.length ? (
                  <AppText variant="caption" style={{ color: theme.colors.textSecondary }}>
                    No services listed here yet. Try another subcategory.
                  </AppText>
                ) : null}
                {sub?.services.map((t) => {
                  const added = addedIds.includes(t.id);
                  const selected = templateId === t.id;
                  return (
                    <PressableFeedback
                      key={t.id}
                      accessibilityRole="radio"
                      accessibilityLabel={added ? `${t.name}, added` : t.name}
                      accessibilityState={{ selected, disabled: added }}
                      disabled={added}
                      onPress={() => setTemplateId(t.id)}
                      style={{
                        flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: theme.radii.md,
                        borderWidth: selected ? 2 : 1, borderColor: selected ? theme.colors.brand : theme.colors.separator,
                        opacity: added ? 0.5 : 1,
                      }}
                    >
                      <View style={{ flex: 1 }}>
                        <AppText variant="label" style={{ fontSize: 15, color: theme.colors.textPrimary }}>{t.name}</AppText>
                        {t.description ? <AppText variant="caption" style={{ color: theme.colors.textMuted, marginTop: 2 }}>{t.description}</AppText> : null}
                      </View>
                      {added ? <AppText variant="caption" style={{ color: theme.colors.textMuted }}>Added</AppText> : null}
                    </PressableFeedback>
                  );
                })}
                {templateId !== null ? (
                  <>
                    <View style={{ flexDirection: 'row', gap: 10 }}>
                      <View style={{ flex: 1 }}>
                        <AppTextField label="Price (₹)" value={price} onChangeText={setPrice} keyboardType="number-pad" placeholder="4500" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <AppTextField label="Duration (minutes)" value={minutes} onChangeText={setMinutes} keyboardType="number-pad" placeholder="120" />
                      </View>
                    </View>
                    <AppTextField label="Note (optional)" value={note} onChangeText={setNote} maxLength={1000} placeholder="e.g. Includes a trial session" />
                    <ServicePhotoField value={photo} onChange={setPhoto} />
                    <ServiceExtrasEditor value={extras} onChange={setExtras} />
                  </>
                ) : null}
              </>
            )}
            {error ? <AppText variant="caption" style={{ color: theme.colors.error }}>{error}</AppText> : null}
          </ScrollView>
          <View style={{ paddingHorizontal: 24 }}>
            <AppButton label="Save service" onPress={() => { void save(); }} loading={saving} disabled={templateId === null} />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
