import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { AppText } from './AppText';
import { AppTextField } from './AppTextField';
import { Icon } from './Icon';
import { useTheme } from '../../core/theme/theme-provider';
import {
  ADDON_NAME_MAX_LENGTH, INCLUDED_ITEM_MAX_LENGTH, MAX_ADDONS, MAX_INCLUDED_ITEMS,
  type AddonDraft, type ExtrasDraft,
} from '../../utils/common/service-extras';

interface ServiceExtrasEditorProps {
  value: ExtrasDraft;
  onChange: (value: ExtrasDraft) => void;
}

const BOX = 20;

/** "What's included" lines and priced add-ons for one service, as on the design's Service detail. */
export function ServiceExtrasEditor({ value, onChange }: ServiceExtrasEditorProps) {
  const theme = useTheme();
  const [item, setItem] = useState('');
  const addItem = () => {
    const text = item.trim();
    if (!text || value.included.length >= MAX_INCLUDED_ITEMS) return;
    onChange({ ...value, included: [...value.included, text] });
    setItem('');
  };
  const setAddon = (index: number, patch: Partial<AddonDraft>) =>
    onChange({ ...value, addons: value.addons.map((a, i) => (i === index ? { ...a, ...patch } : a)) });

  return (
    <View style={{ gap: 12 }}>
      <AppText variant="label" style={{ color: theme.colors.textSecondary }}>What’s included (optional)</AppText>
      {value.included.map((text, i) => (
        <View key={`${text}-${i}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Icon name="check" size={14} color={theme.colors.brand} />
          <AppText variant="body" style={{ flex: 1, color: theme.colors.textPrimary }}>{text}</AppText>
          <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${text}`} hitSlop={8} onPress={() => onChange({ ...value, included: value.included.filter((_, j) => j !== i) })}>
            <Icon name="close" size={16} color={theme.colors.textMuted} />
          </Pressable>
        </View>
      ))}
      {value.included.length < MAX_INCLUDED_ITEMS ? (
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8 }}>
          <View style={{ flex: 1 }}>
            <AppTextField label="Included item" hideLabel placeholder="e.g. Bridal hands" value={item} onChangeText={setItem} maxLength={INCLUDED_ITEM_MAX_LENGTH} onSubmitEditing={addItem} returnKeyType="done" />
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="Add included item" onPress={addItem} style={{ height: 48, paddingHorizontal: 14, justifyContent: 'center' }}>
            <AppText variant="label" style={{ color: theme.colors.brand }}>Add</AppText>
          </Pressable>
        </View>
      ) : null}

      <AppText variant="label" style={{ color: theme.colors.textSecondary, marginTop: 8 }}>Add-ons (optional)</AppText>
      {value.addons.map((a, i) => (
        <View key={i} style={{ gap: 8, padding: 12, borderRadius: theme.radii.md, borderWidth: 1, borderColor: theme.colors.separator }}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <View style={{ flex: 2 }}>
              <AppTextField label={`Add-on ${i + 1} name`} hideLabel placeholder="e.g. Guest mehendi" value={a.name} onChangeText={(name) => setAddon(i, { name })} maxLength={ADDON_NAME_MAX_LENGTH} />
            </View>
            <View style={{ flex: 1 }}>
              <AppTextField label={`Add-on ${i + 1} price (₹)`} hideLabel placeholder="₹ 500" value={a.price} onChangeText={(price) => setAddon(i, { price })} keyboardType="number-pad" />
            </View>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Pressable
              accessibilityRole="checkbox"
              accessibilityLabel={`Add-on ${i + 1} priced per person`}
              accessibilityState={{ checked: a.perPerson }}
              onPress={() => setAddon(i, { perPerson: !a.perPerson })}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
            >
              <View style={{ width: BOX, height: BOX, borderRadius: 5, alignItems: 'center', justifyContent: 'center', borderWidth: a.perPerson ? 0 : 1.5, borderColor: theme.colors.border, backgroundColor: a.perPerson ? theme.colors.brand : theme.colors.surface }}>
                {a.perPerson ? <Icon name="check" size={13} color={theme.colors.textOnBrand} /> : null}
              </View>
              <AppText variant="caption" style={{ color: theme.colors.textSecondary }}>Priced per person</AppText>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel={`Remove add-on ${i + 1}`} hitSlop={8} onPress={() => onChange({ ...value, addons: value.addons.filter((_, j) => j !== i) })}>
              <AppText variant="caption" style={{ color: theme.colors.error }}>Remove</AppText>
            </Pressable>
          </View>
        </View>
      ))}
      {value.addons.length < MAX_ADDONS ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => onChange({ ...value, addons: [...value.addons, { name: '', price: '', perPerson: false }] })}
          style={{ height: 44, borderRadius: theme.radii.md, borderWidth: 1.5, borderStyle: 'dashed', borderColor: theme.colors.border, alignItems: 'center', justifyContent: 'center' }}
        >
          <AppText variant="label" style={{ color: theme.colors.brand }}>+ Add an add-on</AppText>
        </Pressable>
      ) : null}
    </View>
  );
}
