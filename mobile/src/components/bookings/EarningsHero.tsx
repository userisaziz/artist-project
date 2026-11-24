import { View } from 'react-native';
import { PressableFeedback } from '../common/PressableFeedback';
import { AppText } from '../common/AppText';
import { Icon } from '../common/Icon';
import { useTheme } from '../../core/theme/theme-provider';
import { formatPrice } from '../../utils/common/format';
import { monthChange, shortMonth } from '../../utils/bookings/dashboard';
import type { ArtistDashboard } from '../../types/bookings/bookings';

const BAR_AREA = 44;
const MIN_BAR = 3;

interface EarningsHeroProps {
  dashboard: ArtistDashboard;
  onPress: () => void;
}

/** Artist home: this month's earnings against last month, with a six-month bar trend. Taps through to Earnings. */
export function EarningsHero({ dashboard: d, onPress }: EarningsHeroProps) {
  const theme = useTheme();
  const change = monthChange(d.earnings_this_month_paise, d.earnings_last_month_paise);
  const peak = Math.max(...d.trend.map((m) => m.earnings_paise), 1);
  const onBrand = theme.colors.textOnBrand;

  return (
    <PressableFeedback
      accessibilityRole="button"
      accessibilityLabel={`Earnings this month ${formatPrice(d.earnings_this_month_paise)}, ${change.label}. See every month`}
      onPress={onPress}
      style={{ borderRadius: theme.radii.card, backgroundColor: theme.colors.brand, padding: theme.spacing[4.5], gap: theme.spacing[3], ...theme.shadows.md }}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <View style={{ gap: theme.spacing[1] }}>
          <AppText variant="caption" style={{ color: onBrand, opacity: 0.8 }}>Earnings this month</AppText>
          <AppText variant="display" style={{ color: onBrand }}>{formatPrice(d.earnings_this_month_paise)}</AppText>
        </View>
        <Icon name="chevron-right" color={onBrand} />
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing[1.5] }}>
        {change.trend !== 'flat' ? <Icon name={change.trend === 'up' ? 'trending-up' : 'trending-down'} size={16} color={onBrand} /> : null}
        <AppText variant="label" style={{ color: onBrand }}>{change.label}</AppText>
        <AppText variant="caption" style={{ color: onBrand, opacity: 0.8 }}>
          {`· ${d.completed_this_month} completed`}
        </AppText>
      </View>

      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ flexDirection: 'row', alignItems: 'flex-end', gap: theme.spacing[2] }}>
        {d.trend.map((m, i) => {
          const current = i === d.trend.length - 1;
          return (
            <View key={m.month} style={{ flex: 1, alignItems: 'center', gap: theme.spacing[1] }}>
              <View style={{ height: BAR_AREA, width: '100%', justifyContent: 'flex-end' }}>
                <View
                  style={{
                    height: Math.max(MIN_BAR, Math.round((m.earnings_paise / peak) * BAR_AREA)),
                    borderRadius: theme.radii.xs,
                    backgroundColor: onBrand,
                    opacity: current ? 1 : 0.4,
                  }}
                />
              </View>
              <AppText variant="labelSm" style={{ color: onBrand, opacity: current ? 1 : 0.7 }}>{shortMonth(m.month)}</AppText>
            </View>
          );
        })}
      </View>
    </PressableFeedback>
  );
}
