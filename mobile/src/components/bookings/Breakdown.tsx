import { View } from 'react-native';
import { InfoRow } from '../common/InfoRow';
import { useTheme } from '../../core/theme/theme-provider';
import { formatPrice } from '../../utils/common/format';
import { DEPOSIT_PERCENT } from '../../utils/bookings/pricing';
import type { PriceBreakdown } from '../../utils/bookings/pricing';

interface BreakdownProps {
  money: Pick<PriceBreakdown, 'subtotal_paise' | 'platform_fee_paise' | 'total_paise' | 'deposit_paise' | 'balance_paise'>;
  /** Before paying the deposit reads "Deposit today"; afterwards "Deposit paid". */
  paid?: boolean;
}

/** Spec §2 Review: service, platform fee (or Waived), total, then the deposit and balance, or (no deposit)
 *  what is paid to the artist after the service. */
export function Breakdown({ money, paid = false }: BreakdownProps) {
  const theme = useTheme();
  return (
    <View>
      <InfoRow label="Service" value={formatPrice(money.subtotal_paise)} />
      <InfoRow label="Platform fee" value={money.platform_fee_paise ? formatPrice(money.platform_fee_paise) : 'Waived'} />
      <View style={{ height: 1, backgroundColor: theme.colors.separator, marginVertical: 6 }} />
      <InfoRow label="Total" value={formatPrice(money.total_paise)} strong />
      {money.deposit_paise ? (
        <>
          <InfoRow label={paid ? 'Deposit paid' : `Deposit today (${DEPOSIT_PERCENT}%)`} value={formatPrice(money.deposit_paise)} tint={theme.colors.brand} />
          <InfoRow label="Balance after the service" value={formatPrice(money.balance_paise)} />
        </>
      ) : (
        <InfoRow label="Pay the artist after the service" value={formatPrice(money.balance_paise)} tint={theme.colors.brand} />
      )}
    </View>
  );
}
