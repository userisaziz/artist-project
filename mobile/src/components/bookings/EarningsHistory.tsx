import { FlatList, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '../common/AppText';
import { BackHeader } from '../common/BackHeader';
import { ErrorView, LoadingView } from '../common/StateViews';
import { useTheme } from '../../core/theme/theme-provider';
import { useArtistEarnings } from '../../hooks/bookings/bookings';
import { formatPrice } from '../../utils/common/format';
import { formatMonth } from '../../utils/common/time';
import type { MonthEarnings } from '../../types/bookings/bookings';

const MONTHS_SHOWN = 12;

function monthLabel(month: string): string {
  const [year, m] = month.split('-').map(Number);
  return formatMonth(year, m);
}

/** Home / Me → Earnings: completed bookings and what the artist kept, month by month. Clients pay the artist directly. */
export function EarningsHistory() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const earnings = useArtistEarnings(MONTHS_SHOWN);
  const months = earnings.data?.months ?? [];
  const total = months.reduce((sum, m) => sum + m.earnings_paise, 0);
  const anything = months.some((m) => m.bookings > 0);

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background, paddingTop: insets.top + theme.spacing.sm, paddingHorizontal: theme.spacing.md }}>
      <BackHeader title="Earnings" />
      {earnings.isPending ? <LoadingView label="Loading your earnings" /> : null}
      {earnings.isError && !earnings.data ? <ErrorView error={earnings.error} onRetry={() => { void earnings.refetch(); }} /> : null}
      {earnings.data ? (
        <FlatList
          data={months}
          keyExtractor={(m) => m.month}
          ListHeaderComponent={(
            <View style={{ borderRadius: theme.radii.card, backgroundColor: theme.colors.brandSoft, padding: 16, marginVertical: 12, gap: 4 }}>
              <AppText variant="caption" style={{ color: theme.colors.textMuted }}>Last 12 months</AppText>
              <AppText variant="display" style={{ fontSize: 28, lineHeight: 34, color: theme.colors.heading }}>{formatPrice(total)}</AppText>
              <AppText variant="caption" style={{ color: theme.colors.textSecondary }}>
                {anything ? 'What you kept from completed bookings. Clients pay you directly.' : 'Complete a booking and your earnings show up here.'}
              </AppText>
            </View>
          )}
          renderItem={({ item }) => <MonthRow month={item} />}
          contentContainerStyle={{ paddingBottom: insets.bottom + theme.spacing.xl }}
        />
      ) : null}
    </View>
  );
}

function MonthRow({ month }: { month: MonthEarnings }) {
  const theme = useTheme();
  const empty = month.bookings === 0;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: theme.colors.separator }}>
      <View style={{ flex: 1 }}>
        <AppText variant="label" style={{ color: theme.colors.textPrimary }}>{monthLabel(month.month)}</AppText>
        <AppText variant="caption" style={{ color: theme.colors.textMuted }}>{empty ? 'No completed bookings' : `${month.bookings} completed`}</AppText>
      </View>
      <AppText variant="subtitle" style={{ color: empty ? theme.colors.textMuted : theme.colors.textPrimary }}>{formatPrice(month.earnings_paise)}</AppText>
    </View>
  );
}
