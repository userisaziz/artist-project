import { View } from 'react-native';
import { PressableFeedback } from '../common/PressableFeedback';
import { AppText } from '../common/AppText';
import { Icon } from '../common/Icon';
import { useTheme } from '../../core/theme/theme-provider';

interface ExploreResultsHeaderProps {
  /** "86 artists", or "20+ artists" when the server didn't count. */
  count: string;
  /** "in Bangalore", "near you" or "in all cities". */
  where: string;
  sortLabel: string;
  onWhere: () => void;
  onSort: () => void;
}

/** "86 artists in Bangalore ▾ … Recommended ▾": the result count, the place (tap to change city) and the sort. */
export function ExploreResultsHeader({ count, where, sortLabel, onWhere, onSort }: ExploreResultsHeaderProps) {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 18, paddingBottom: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 1 }}>
        <AppText variant="caption" style={{ fontSize: 13, fontWeight: '700', color: theme.colors.textPrimary }}>{count}</AppText>
        <PressableFeedback accessibilityRole="button" accessibilityLabel={`Showing artists ${where}. Change city`} onPress={onWhere} hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
          <AppText variant="caption" numberOfLines={1} style={{ fontSize: 13, color: theme.colors.textMuted }}>{where}</AppText>
          <Icon name="chevron-down" size={13} color={theme.colors.textMuted} />
        </PressableFeedback>
      </View>
      <PressableFeedback accessibilityRole="button" accessibilityLabel={`Sort: ${sortLabel}`} onPress={onSort} hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
        <AppText variant="caption" style={{ fontSize: 13, fontWeight: '600', color: theme.colors.brand }}>{sortLabel}</AppText>
        <Icon name="chevron-down" size={13} color={theme.colors.brand} />
      </PressableFeedback>
    </View>
  );
}
