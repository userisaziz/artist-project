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
  /** Red border when the last submit failed */
  error?: boolean;
}

/** Indian numbers read as "98450 67890"; other countries stay as typed digits. */
function formatNational(code: string, digits: string) {
  return code === '+91' && digits.length > 5 ? `${digits.slice(0, 5)} ${digits.slice(5)}` : digits;
}

export function PhoneInput({ value, onChange, error = false }: Props) {
  const theme = useTheme();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const country = COUNTRIES.find((c) => value.startsWith(c.code)) ?? COUNTRIES[0];
  const national = value.slice(country.code.length).replace(/\D/g, '');

  const emit = (code: string, nat: string) => onChange(code + nat);

  return (
    <View>
      <View
        style={{
          height: 57, borderRadius: theme.radii.md, borderWidth: 1.5,
          borderColor: error ? theme.colors.error : focused ? theme.colors.borderFocus : theme.colors.border,
          backgroundColor: theme.colors.inputBackground,
          flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md - theme.spacing.xs, paddingHorizontal: theme.spacing.md,
        }}
      >
        <Pressable testID="country-code-chip" accessibilityLabel={`Country code ${country.code}`} onPress={() => setPickerOpen(true)} hitSlop={theme.spacing.sm}>
          <AppText variant="subtitle" style={{ color: theme.colors.textPrimary }}>{country.code}</AppText>
        </Pressable>
        <View style={{ width: 1, height: 22, backgroundColor: theme.colors.separator }} />
        <TextInput
          testID="phone-national"
          value={formatNational(country.code, national)}
          onChangeText={(t) => emit(country.code, t.replace(/\D/g, ''))}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          keyboardType="phone-pad"
          placeholder={country.code === '+91' ? '98450 67890' : 'Phone number'}
          placeholderTextColor={theme.colors.textMuted}
          style={{
            flex: 1, height: '100%', color: theme.colors.textPrimary,
            fontSize: theme.typography.subtitle.fontSize, fontFamily: theme.typography.body.fontFamily,
          }}
        />
      </View>
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
