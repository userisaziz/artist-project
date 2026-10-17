import { useState } from 'react';
import { Modal, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '../core/components/AppText';
import { fieldBorder } from '../core/components/FieldHalo';
import { useTheme } from '../core/theme/theme-provider';

/** Field-styled button that opens a bottom-sheet list of the supported cities. */
export function CityField({ value, cities, onChange }: { value: string | null; cities: string[]; onChange: (city: string) => void }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="City"
        onPress={() => setOpen(true)}
        style={{
          height: 50, borderRadius: theme.radii.md, ...fieldBorder(theme.colors, false, false), backgroundColor: theme.colors.inputBackground,
          paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        }}
      >
        <AppText variant="subtitle" style={{ color: value ? theme.colors.textPrimary : theme.colors.textMuted }}>{value ?? 'Choose your city'}</AppText>
        <AppText style={{ color: theme.colors.brand }}>▾</AppText>
      </Pressable>
      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable accessibilityLabel="Close" style={{ flex: 1, backgroundColor: theme.colors.overlay }} onPress={() => setOpen(false)} />
        <View style={{ backgroundColor: theme.colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 12, paddingBottom: insets.bottom + 12 }}>
          {cities.map((city) => (
            <Pressable
              key={city}
              accessibilityRole="button"
              onPress={() => { onChange(city); setOpen(false); }}
              style={{ paddingVertical: 14, paddingHorizontal: 24, flexDirection: 'row', justifyContent: 'space-between' }}
            >
              <AppText variant="subtitle" style={{ color: theme.colors.textPrimary }}>{city}</AppText>
              {city === value ? <AppText style={{ color: theme.colors.brand }}>✓</AppText> : null}
            </Pressable>
          ))}
        </View>
      </Modal>
    </>
  );
}
