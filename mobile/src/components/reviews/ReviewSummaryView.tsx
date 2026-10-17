import { View } from 'react-native';
import { AppText } from '../common/AppText';
import { useTheme } from '../../core/theme/theme-provider';
import { formatAverage, reviewCountLabel } from '../../utils/reviews/format';
import { Stars } from './Stars';
import type { ReviewSummary } from '../../types/reviews/reviews';

const ROWS = ['5', '4', '3', '2', '1'] as const;
const BAR_HEIGHT = 6;

/** The big average with its stars, and a 5→1 distribution with bars (the prototype's Reviews block). */
export function ReviewSummaryView({ summary }: { summary: ReviewSummary }) {
  const theme = useTheme();
  const { average, count, distribution } = summary;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
      <View style={{ alignItems: 'flex-start', minWidth: 72 }}>
        <AppText variant="display" style={{ fontSize: 44, lineHeight: 48, color: theme.colors.heading }}>{average === null ? '–' : formatAverage(average)}</AppText>
        {average === null ? null : <Stars rating={average} />}
        <AppText variant="caption" style={{ color: theme.colors.textMuted, marginTop: 2 }}>{reviewCountLabel(count)}</AppText>
      </View>
      <View style={{ flex: 1, gap: 5 }}>
        {ROWS.map((stars) => {
          const n = distribution[stars];
          const share = count ? n / count : 0;
          return (
            <View key={stars} accessible accessibilityLabel={`${stars} stars: ${n}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <AppText variant="caption" style={{ width: 10, color: theme.colors.textMuted }}>{stars}</AppText>
              <View style={{ flex: 1, height: BAR_HEIGHT, borderRadius: BAR_HEIGHT / 2, backgroundColor: theme.colors.brandSoft, overflow: 'hidden' }}>
                <View style={{ width: `${Math.round(share * 100)}%`, height: BAR_HEIGHT, borderRadius: BAR_HEIGHT / 2, backgroundColor: theme.colors.accent }} />
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}
