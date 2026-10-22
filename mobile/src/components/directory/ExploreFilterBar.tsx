import { ScrollView } from 'react-native';
import { FilterChip } from '../common/FilterChip';
import type { IconName } from '../common/Icon';
import { useTheme } from '../../core/theme/theme-provider';

export interface FilterChipSpec {
  key: string;
  label: string;
  active: boolean;
  onPress: () => void;
  accessibilityLabel?: string;
  icon?: IconName;
  opensMenu?: boolean;
}

/** Explore's horizontally scrolling row of filter chips. */
export function ExploreFilterBar({ chips }: { chips: FilterChipSpec[] }) {
  const theme = useTheme();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={{ flexGrow: 0 }}
      contentContainerStyle={{ gap: 8, paddingHorizontal: theme.spacing.md, paddingTop: 12 }}
    >
      {chips.map(({ key, ...chip }) => <FilterChip key={key} {...chip} />)}
    </ScrollView>
  );
}
