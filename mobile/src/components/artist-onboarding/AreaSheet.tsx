import { useState } from 'react';
import { View } from 'react-native';
import { PressableFeedback } from '../common/PressableFeedback';
import { AppText } from '../common/AppText';
import { AppTextField } from '../common/AppTextField';
import { BottomSheet } from '../common/BottomSheet';
import { Icon } from '../common/Icon';
import { useTheme } from '../../core/theme/theme-provider';
import type { Area } from '../../types/catalog/catalog';

interface AreaSheetProps {
  visible: boolean;
  city: string;
  areas: Area[];
  selectedId: number | null;
  onPick: (area: Area) => void;
  onClose: () => void;
}

/** "Choose your area": a search box over the city's areas (a city has a few dozen), ticked when chosen. */
export function AreaSheet({ visible, city, areas, selectedId, onPick, onClose }: AreaSheetProps) {
  const theme = useTheme();
  const [query, setQuery] = useState('');
  const needle = query.trim().toLowerCase();
  const shown = needle ? areas.filter((a) => a.name.toLowerCase().includes(needle)) : areas;
  const pick = (area: Area) => { setQuery(''); onPick(area); };
  return (
    <BottomSheet visible={visible} title={`Areas in ${city}`} onClose={onClose}>
      <AppTextField label="Search area" hideLabel placeholder="Search area" value={query} onChangeText={setQuery} autoCorrect={false} />
      <View style={{ marginTop: 12 }}>
        {shown.length ? shown.map((a) => (
          <PressableFeedback
            key={a.id}
            accessibilityRole="button"
            accessibilityState={{ selected: a.id === selectedId }}
            onPress={() => pick(a)}
            style={{ minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderColor: theme.colors.separator }}
          >
            <AppText variant="body" style={{ color: a.id === selectedId ? theme.colors.brand : theme.colors.textPrimary }}>{a.name}</AppText>
            {a.id === selectedId ? <Icon name="check" size={18} color={theme.colors.brand} /> : null}
          </PressableFeedback>
        )) : (
          <AppText variant="body" style={{ color: theme.colors.textMuted }}>
            {needle ? 'No area by that name yet. Pick the nearest one, or contact support to add yours.' : 'No areas listed for this city yet.'}
          </AppText>
        )}
      </View>
    </BottomSheet>
  );
}
