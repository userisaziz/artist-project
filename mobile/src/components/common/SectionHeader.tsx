import type { ReactNode } from 'react';
import { View } from 'react-native';
import { PressableFeedback } from './PressableFeedback';
import { AppText } from './AppText';
import { useTheme } from '../../core/theme/theme-provider';

interface SectionHeaderProps {
  title: ReactNode;
  /** Shown as a "See all" link on the right when set. */
  onSeeAll?: () => void;
  /** Screen-reader name for the link, e.g. "See all artists". */
  seeAllLabel?: string;
}


/** A screen section's heading with an optional "See all" link, as on the design's Home. */
export function SectionHeader({ title, onSeeAll, seeAllLabel = 'See all' }: SectionHeaderProps) {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', paddingHorizontal: theme.spacing.md, paddingTop: theme.spacing[7], paddingBottom: theme.spacing[3] }}>
      <AppText variant="sectionTitle" style={{ color: theme.colors.textPrimary }}>{title}</AppText>
      {onSeeAll ? (
        <PressableFeedback accessibilityRole="button" accessibilityLabel={seeAllLabel} onPress={onSeeAll} hitSlop={8}>
          <AppText variant="labelLg" style={{ color: theme.colors.brand }}>See all</AppText>
        </PressableFeedback>
      ) : null}
    </View>
  );
}
