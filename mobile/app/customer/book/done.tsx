import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText, Accent } from '../../../src/components/common/AppText';
import { AppButton } from '../../../src/components/common/AppButton';
import { Card } from '../../../src/components/common/Card';
import { InfoRow } from '../../../src/components/common/InfoRow';
import { ErrorView, LoadingView } from '../../../src/components/common/StateViews';
import { useTheme } from '../../../src/core/theme/theme-provider';
import { useBooking } from '../../../src/hooks/bookings/bookings';
import { ACCEPT_WINDOW_HOURS } from '../../../src/utils/bookings/pricing';
import { formatWhen } from '../../../src/utils/common/time';
import { formatPrice } from '../../../src/utils/common/format';

// Spec §2 Booking requested.
export default function BookingRequested() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id = '' } = useLocalSearchParams<{ id: string }>();
  const booking = useBooking(id);
  const home = () => router.dismissTo('/customer/home');

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.canvas, paddingTop: insets.top + 56, paddingHorizontal: theme.spacing.lg, paddingBottom: insets.bottom + theme.spacing.lg }}>
      <View style={{ alignSelf: 'center', width: 72, height: 72, borderRadius: 36, backgroundColor: theme.colors.pendingSoft, alignItems: 'center', justifyContent: 'center' }}>
        <Svg width={34} height={34} viewBox="0 0 24 24" fill="none" stroke={theme.colors.pendingInk} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
          <Path d="M5 12.5l4.5 4.5L19 7.5" />
        </Svg>
      </View>
      {booking.data ? (
        <View style={{ alignSelf: 'center', marginTop: 16, paddingVertical: 5, paddingHorizontal: 12, borderRadius: theme.radii.pill, backgroundColor: theme.colors.pendingSoft }}>
          <AppText variant="label" style={{ fontSize: 12, color: theme.colors.pendingInk }}>{`Waiting for ${booking.data.artist.business_name}`}</AppText>
        </View>
      ) : null}
      <AppText variant="display" style={{ textAlign: 'center', color: theme.colors.heading, marginTop: 20 }}>
        {'Booking '}<Accent color={theme.colors.pendingInk}>requested</Accent>
      </AppText>
      {booking.isPending ? <LoadingView /> : null}
      {booking.isError ? <ErrorView error={booking.error} onRetry={() => { void booking.refetch(); }} /> : null}
      {booking.data ? (
        <>
          <AppText variant="body" style={{ textAlign: 'center', color: theme.colors.textSecondary, marginTop: 8 }}>
            {`${booking.data.artist.business_name} usually confirms within ${ACCEPT_WINDOW_HOURS} hours.`}
          </AppText>
          <Card style={{ marginTop: 24 }}>
            <InfoRow label="Booking" value={booking.data.code} />
            <InfoRow label="Service" value={booking.data.service_name} />
            <InfoRow label="When" value={formatWhen(booking.data.start_at)} />
            {booking.data.deposit_paise
              ? <InfoRow label="Deposit paid" value={formatPrice(booking.data.deposit_paise)} />
              : <InfoRow label="Pay the artist after the service" value={formatPrice(booking.data.total_paise)} />}
          </Card>
        </>
      ) : null}
      <View style={{ flex: 1 }} />
      <View style={{ gap: 8 }}>
        <AppButton label="View booking" disabled={!booking.data} onPress={() => { home(); router.push({ pathname: '/customer/booking/[id]', params: { id } }); }} />
        <AppButton label="Back to home" variant="ghost" onPress={home} />
      </View>
    </View>
  );
}
