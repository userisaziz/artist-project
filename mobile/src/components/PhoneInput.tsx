import { Pressable, TextInput, View, Modal, FlatList } from 'react-native';
import { useState } from 'react';
import { useTheme } from '../theme/theme-provider';
import { AppText } from './AppText';

export const COUNTRIES = [
  { code: '+91', name: 'India' }, { code: '+1', name: 'USA / Canada' }, { code: '+44', name: 'UK' },
  { code: '+971', name: 'UAE' }, { code: '+966', name: 'Saudi Arabia' }, { code: '+62', name: 'Indonesia' },
  { code: '+60', name: 'Malaysia' }, { code: '+880', name: 'Bangladesh' }, { code: '+92', name: 'Pakistan' },
  { code: '+234', name: 'Nigeria' }, { code: '+254', name: 'Kenya' }, { code: '+27', name: 'South Africa' },
];

interface Props {
  /** Full E.164 value, e.g. '+919876543210' */
  value: string;
  onChange: (e164: string) => void;
}

export function PhoneInput({ value, onChange }: Props) {
  const theme = useTheme();
  const [pickerOpen, setPickerOpen] = useState(false);
  const country = COUNTRIES.find((c) => value.startsWith(c.code)) ?? COUNTRIES[0];
  const national = value.slice(country.code.length).replace(/\D/g, '');

  const emit = (code: string, nat: string) => onChange(code + nat);

  return (
    <View>
      <View style={{ flexDirection: 'row', gap: theme.spacing.sm, alignItems: 'center' }}>
        <Pressable
          testID="country-code-chip"
          onPress={() => setPickerOpen(true)}
          style={{
            height: 52, paddingHorizontal: theme.spacing.md, borderRadius: theme.radii.md,
            borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.inputBackground,
            alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 4,
          }}
        >
          <AppText variant="subtitle" style={{ color: theme.colors.textPrimary }}>{country.code} ▾</AppText>
        </Pressable>
        <TextInput
          testID="phone-national"
          value={national}
          onChangeText={(t) => emit(country.code, t.replace(/\D/g, ''))}
          keyboardType="phone-pad"
          placeholder="98765 43210"
          placeholderTextColor={theme.colors.textMuted}
          style={{
            flex: 1, height: 52, borderRadius: theme.radii.md, borderWidth: 1,
            borderColor: theme.colors.border, backgroundColor: theme.colors.inputBackground,
            color: theme.colors.textPrimary, paddingHorizontal: theme.spacing.md,
            fontSize: theme.typography.body.fontSize, fontFamily: theme.typography.body.fontFamily,
          }}
        />
      </View>
      <Modal visible={pickerOpen} transparent animationType="fade" onRequestClose={() => setPickerOpen(false)}>
        <Pressable style={{ flex: 1, backgroundColor: '#00000088', justifyContent: 'flex-end' }} onPress={() => setPickerOpen(false)}>
          <View style={{ backgroundColor: theme.colors.surface, borderTopLeftRadius: theme.radii.card, borderTopRightRadius: theme.radii.card, padding: theme.spacing.md, maxHeight: 420 }}>
            <FlatList
              data={COUNTRIES}
              keyExtractor={(c) => c.code}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => { emit(item.code, national); setPickerOpen(false); }}
                  style={{ paddingVertical: theme.spacing.sm, flexDirection: 'row', justifyContent: 'space-between' }}
                >
                  <AppText variant="body" style={{ color: theme.colors.textPrimary }}>{item.name}</AppText>
                  <AppText variant="body" style={{ color: theme.colors.textSecondary }}>{item.code}</AppText>
                </Pressable>
              )}
            />
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}
