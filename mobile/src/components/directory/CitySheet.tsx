import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { AppText } from '../common/AppText';
import { AppTextField } from '../common/AppTextField';
import { BottomSheet } from '../common/BottomSheet';
import { useTheme } from '../../core/theme/theme-provider';

interface CitySheetProps {
  visible: boolean;
  cities: string[];
  selected: string | null;
  onPick: (city: string | null) => void;
  onClose: () => void;
}

/** "Choose your city": a search box over the cities artists work in, as a grid; "All cities" clears the choice. */
export function CitySheet({ visible, cities, selected, onPick, onClose }: CitySheetProps) {
  const theme = useTheme();
  const [query, setQuery] = useState('');
  const needle = query.trim().toLowerCase();
  const shown = needle ? cities.filter((c) => c.toLowerCase().includes(needle)) : cities;
  const pick = (city: string | null) => { setQuery(''); onPick(city); };

  return (
    <BottomSheet visible={visible} title="Choose your city" onClose={onClose}>
      <AppTextField label="Search city" hideLabel placeholder="Search city" value={query} onChangeText={setQuery} autoCorrect={false} />
      <AppText variant="eyebrow" style={{ color: theme.colors.textMuted, marginTop: 18, marginBottom: 10 }}>CITIES</AppText>
      {shown.length ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {shown.map((c) => <CityButton key={c} label={c} on={c === selected} onPress={() => pick(c)} />)}
        </View>
      ) : (
        <AppText variant="body" style={{ color: theme.colors.textMuted }}>No artists in that city yet.</AppText>
      )}
      {selected ? (
        <Pressable accessibilityRole="button" onPress={() => pick(null)} hitSlop={8} style={{ alignSelf: 'flex-start', marginTop: 16 }}>
          <AppText variant="label" style={{ color: theme.colors.brand }}>Show all cities</AppText>
        </Pressable>
      ) : null}
    </BottomSheet>
  );
}

function CityButton({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      onPress={onPress}
      style={{
        width: '31.5%', height: 44, borderRadius: theme.radii.md, alignItems: 'center', justifyContent: 'center', borderWidth: 1,
        backgroundColor: on ? theme.colors.brand : theme.colors.surface, borderColor: on ? theme.colors.brand : theme.colors.separator,
      }}
    >
      <AppText variant="label" numberOfLines={1} style={{ fontSize: 13.5, color: on ? theme.colors.textOnBrand : theme.colors.textPrimary }}>{label}</AppText>
    </Pressable>
  );
}
