import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '../components/AppText';
import { AppButton } from '../components/AppButton';
import { AppTextField } from '../components/AppTextField';
import { Chip } from '../components/Chip';
import { useTheme } from '../theme/theme-provider';
import { errorMessage } from '../api/error-message';
import type { Category, ServiceInput } from '../api/types';

const MAX_RUPEES = 1_000_000; // backend ServiceIn: price_paise ≤ 100 000 000
const MAX_MINUTES = 1440;

/** Bottom sheet for one service: category (from the artist's own), name, price in ₹ and duration in minutes. */
export function AddServiceSheet({ visible, categories, onClose, onSubmit }: {
  visible: boolean;
  categories: Category[];
  onClose: () => void;
  onSubmit: (service: ServiceInput) => Promise<void>;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [minutes, setMinutes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Each opening starts blank; a single category is preselected.
  useEffect(() => {
    if (!visible) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCategoryId(categories.length === 1 ? categories[0].id : null);
    setName(''); setPrice(''); setMinutes(''); setError(null);
  }, [visible, categories]);

  const save = async () => {
    const rupees = Number(price);
    const mins = Number(minutes);
    if (categoryId === null) { setError('Pick a category.'); return; }
    if (!Number.isInteger(rupees) || rupees <= 0 || rupees > MAX_RUPEES) { setError('Enter a price above ₹0.'); return; }
    if (!Number.isInteger(mins) || mins <= 0 || mins > MAX_MINUTES) { setError('Enter a duration between 1 and 1440 minutes.'); return; }
    setSaving(true);
    setError(null);
    try {
      await onSubmit({ category_id: categoryId, name: name.trim(), price_paise: rupees * 100, duration_minutes: mins });
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
        <Pressable accessibilityLabel="Close" style={{ flex: 1, backgroundColor: theme.colors.overlay }} onPress={onClose} />
        <View style={{ backgroundColor: theme.colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: insets.bottom + 16, gap: 14 }}>
          <AppText variant="title" style={{ color: theme.colors.heading }}>Add a service</AppText>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {categories.map((c) => <Chip key={c.id} label={c.name} selected={categoryId === c.id} onPress={() => setCategoryId(c.id)} />)}
          </View>
          <AppTextField label="Service name" value={name} onChangeText={setName} maxLength={120} placeholder="e.g. Bridal mehendi" />
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <AppTextField label="Price (₹)" value={price} onChangeText={setPrice} keyboardType="number-pad" placeholder="4500" />
            </View>
            <View style={{ flex: 1 }}>
              <AppTextField label="Duration (minutes)" value={minutes} onChangeText={setMinutes} keyboardType="number-pad" placeholder="120" />
            </View>
          </View>
          {error ? <AppText variant="caption" style={{ color: theme.colors.error }}>{error}</AppText> : null}
          <AppButton label="Save service" onPress={() => { void save(); }} loading={saving} disabled={!name.trim()} />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
