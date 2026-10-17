import { Pressable, TextInput, View, Modal, FlatList } from 'react-native';
import { useState } from 'react';
import { useTheme } from '../../core/theme/theme-provider';
import { AppText } from './AppText';
import { FieldHalo, fieldBorder } from './FieldHalo';

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
  /** Red border when the last submit failed */
  error?: boolean;
  autoFocus?: boolean;
}

/** "+919845012345" → "+91 98450 12345"; other countries → "{code} {national}". */
export function formatPhone(phone: string): string {
  const code = COUNTRIES.map((c) => c.code)
    .filter((c) => phone.startsWith(c))
    .sort((a, b) => b.length - a.length)[0];
  if (!code) return phone;
  const national = phone.slice(code.length);
  if (code === '+91' && national.length === 10) return `+91 ${national.slice(0, 5)} ${national.slice(5)}`;
  return `${code} ${national}`;
}

/** Indian numbers read as "98450 67890"; other countries stay as typed digits. */
function formatNational(code: string, digits: string) {
  return code === '+91' && digits.length > 5 ? `${digits.slice(0, 5)} ${digits.slice(5)}` : digits;
}

export function PhoneInput({ value, onChange, error = false, autoFocus = false }: Props) {
  const theme = useTheme();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const country = COUNTRIES.find((c) => value.startsWith(c.code)) ?? COUNTRIES[0];
  const national = value.slice(country.code.length).replace(/\D/g, '');

  const emit = (code: string, nat: string) => onChange(code + nat);

  return (
    <View>
      <FieldHalo focused={focused && !error} radius={theme.radii.md}>
      <View
        style={{
          height: 54, borderRadius: theme.radii.md, ...fieldBorder(theme.colors, focused, error),
          backgroundColor: theme.colors.inputBackground,
          flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14,
        }}
      >
        <Pressable testID="country-code-chip" accessibilityLabel={`Country code ${country.code}`} onPress={() => setPickerOpen(true)} hitSlop={theme.spacing.sm}>
          <AppText variant="subtitle" style={{ fontSize: 17, color: theme.colors.textPrimary }}>{country.code}</AppText>
        </Pressable>
        <View style={{ width: 1, height: 22, backgroundColor: theme.colors.separator }} />
        <TextInput
          testID="phone-national"
          cursorColor={theme.colors.brand}
          selectionColor={`${theme.colors.brand}55`}
          selectionHandleColor={theme.colors.brand}
          value={formatNational(country.code, national)}
          onChangeText={(t) => emit(country.code, t.replace(/\D/g, ''))}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          keyboardType="phone-pad"
          autoFocus={autoFocus}
          placeholder={country.code === '+91' ? '98450 67890' : 'Phone number'}
          placeholderTextColor={theme.colors.textMuted}
          style={{
            flex: 1, height: '100%', color: theme.colors.textPrimary,
            fontSize: 17, fontFamily: theme.typography.body.fontFamily,
          }}
        />
      </View>
      </FieldHalo>
      <Modal visible={pickerOpen} transparent animationType="fade" onRequestClose={() => setPickerOpen(false)}>
        <Pressable style={{ flex: 1, backgroundColor: theme.colors.overlay, justifyContent: 'flex-end' }} onPress={() => setPickerOpen(false)}>
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
