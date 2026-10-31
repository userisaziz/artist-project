import { useState } from 'react';
import { View } from 'react-native';
import { PressableFeedback } from '../common/PressableFeedback';
import { AppText } from '../common/AppText';
import { BottomSheet } from '../common/BottomSheet';
import { fieldBorder } from '../common/FieldHalo';
import { useTheme } from '../../core/theme/theme-provider';
import { Icon } from '../common/Icon';

/** Field-styled button that opens a bottom-sheet list of the supported cities. */
export function CityField({ value, cities, onChange }: { value: string | null; cities: string[]; onChange: (city: string) => void }) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  return (
    <>
      <PressableFeedback
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
      </PressableFeedback>
      <BottomSheet visible={open} title="Choose your city" onClose={() => setOpen(false)}>
        {cities.map((city) => (
          <PressableFeedback
            key={city}
            accessibilityRole="button"
            onPress={() => { onChange(city); setOpen(false); }}
            style={{ paddingVertical: 14, paddingHorizontal: 4, flexDirection: 'row', justifyContent: 'space-between' }}
          >
            <AppText variant="subtitle" style={{ color: theme.colors.textPrimary }}>{city}</AppText>
            {city === value ? <Icon name="check" size={18} color={theme.colors.brand} /> : null}
          </PressableFeedback>
        ))}
      </BottomSheet>
    </>
  );
}
