import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { AppText } from './AppText';
import { useTheme } from '../../core/theme/theme-provider';

interface SectionHeaderProps {
  title: ReactNode;
  /** Shown as a "See all" link on the right when set. */
  onSeeAll?: () => void;
  /** Screen-reader name for the link, e.g. "See all artists". */
  seeAllLabel?: string;
}

const TITLE_SIZE = 18.7; // the design's 24px heading at the Plus Jakarta scale (x0.78)

/** A screen section's heading with an optional "See all" link, as on the design's Home. */
export function SectionHeader({ title, onSeeAll, seeAllLabel = 'See all' }: SectionHeaderProps) {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', paddingHorizontal: theme.spacing.md, paddingTop: 28, paddingBottom: 12 }}>
      <AppText variant="title" style={{ fontSize: TITLE_SIZE, lineHeight: 24, color: theme.colors.textPrimary }}>{title}</AppText>
      {onSeeAll ? (
        <Pressable accessibilityRole="button" accessibilityLabel={seeAllLabel} onPress={onSeeAll} hitSlop={8}>
          <AppText variant="label" style={{ fontSize: 13, color: theme.colors.brand }}>See all</AppText>
        </Pressable>
      ) : null}
    </View>
  );
}
