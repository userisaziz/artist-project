import { ScrollView } from 'react-native';
import { FilterChip } from '../common/FilterChip';
import type { ChipIcon } from '../common/FilterChip';
import { useTheme } from '../../core/theme/theme-provider';

export interface FilterChipSpec {
  key: string;
  label: string;
  active: boolean;
  onPress: () => void;
  accessibilityLabel?: string;
  icon?: ChipIcon;
  trailingIcon?: ChipIcon;
}

/** Explore's horizontally scrolling row of filter chips. The vertical padding leaves room for the chips' hitSlop,
 *  which Android only honours inside the parent's bounds. */
export function ExploreFilterBar({ chips }: { chips: FilterChipSpec[] }) {
  const theme = useTheme();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={{ flexGrow: 0 }}
      contentContainerStyle={{ gap: theme.spacing.sm, paddingHorizontal: theme.spacing.md, paddingTop: theme.spacing[3], paddingBottom: theme.spacing[1.5] }}
    >
      {chips.map(({ key, ...chip }) => <FilterChip key={key} {...chip} />)}
    </ScrollView>
  );
}
