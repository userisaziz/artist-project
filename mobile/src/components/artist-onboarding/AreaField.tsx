import { useState } from 'react';
import { PressableFeedback } from '../common/PressableFeedback';
import { AppText } from '../common/AppText';
import { fieldBorder } from '../common/FieldHalo';
import { Icon } from '../common/Icon';
import { useTheme } from '../../core/theme/theme-provider';
import type { Area } from '../../types/catalog/catalog';
import { AreaSheet } from './AreaSheet';

interface AreaFieldProps {
  city: string;
  areas: Area[];
  value: Area | null;
  onChange: (area: Area) => void;
}

/** Field-styled button showing the chosen area; opens the city's area list. */
export function AreaField({ city, areas, value, onChange }: AreaFieldProps) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  return (
    <>
      <PressableFeedback
        accessibilityRole="button"
        accessibilityLabel={value ? `Area: ${value.name}. Change area` : 'Choose your area'}
        onPress={() => setOpen(true)}
        style={{
          height: 50, borderRadius: theme.radii.md, ...fieldBorder(theme.colors, false, false), backgroundColor: theme.colors.inputBackground,
          paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        }}
      >
        <AppText variant="subtitle" style={{ color: value ? theme.colors.textPrimary : theme.colors.textMuted }}>{value?.name ?? 'Choose your area'}</AppText>
        <Icon name="chevron-down" size={16} color={theme.colors.brand} />
      </PressableFeedback>
      <AreaSheet
        visible={open}
        city={city}
        areas={areas}
        selectedId={value?.id ?? null}
        onPick={(area) => { onChange(area); setOpen(false); }}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
