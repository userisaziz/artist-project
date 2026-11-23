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

// The platform's minimum touch target; the one-line links make up the rest with hitSlop.
const MIN_TOUCH = 44;

/** "86 artists in Bangalore ▾ … Recommended ▾": the result count, the place (tap to change city) and the sort. */
export function ExploreResultsHeader({ count, where, sortLabel, onWhere, onSort }: ExploreResultsHeaderProps) {
  const theme = useTheme();
  const line = theme.typography.labelLg.lineHeight;
  const vertical = Math.max(0, (MIN_TOUCH - line) / 2);
  const hitSlop = { top: vertical, bottom: vertical, left: theme.spacing.sm, right: theme.spacing.sm };
  const caret = theme.typography.labelLg.fontSize;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: theme.spacing[4.5], paddingBottom: theme.spacing[2.5] }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs, flexShrink: 1 }}>
        <AppText variant="labelLg" style={{ fontWeight: '700', color: theme.colors.textPrimary }}>{count}</AppText>
        <PressableFeedback accessibilityRole="button" accessibilityLabel={`Showing artists ${where}. Change city`} onPress={onWhere} hitSlop={hitSlop} style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing[0.5], flexShrink: 1 }}>
          <AppText variant="bodySm" numberOfLines={1} style={{ color: theme.colors.textMuted, flexShrink: 1 }}>{where}</AppText>
          <Icon name="chevron-down" size={caret} color={theme.colors.textMuted} />
        </PressableFeedback>
      </View>
      <PressableFeedback accessibilityRole="button" accessibilityLabel={`Sort: ${sortLabel}`} onPress={onSort} hitSlop={hitSlop} style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing[0.5] }}>
        <AppText variant="labelLg" style={{ color: theme.colors.brand }}>{sortLabel}</AppText>
        <Icon name="chevron-down" size={caret} color={theme.colors.brand} />
      </PressableFeedback>
    </View>
  );
}
