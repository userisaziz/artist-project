import { View } from 'react-native';
import { InfoRow } from '../core/components/InfoRow';
import { useTheme } from '../core/theme/theme-provider';
import { formatPrice } from '../core/lib/format';
import { DEPOSIT_PERCENT } from './pricing';
import type { PriceBreakdown } from './pricing';

interface BreakdownProps {
  money: Pick<PriceBreakdown, 'subtotal_paise' | 'platform_fee_paise' | 'total_paise' | 'deposit_paise' | 'balance_paise'>;
  /** Before paying the deposit reads "Deposit today"; afterwards "Deposit paid". */
  paid?: boolean;
}

/** Spec §2 Review & pay: service, platform fee (or Waived), total, deposit, balance after the service. */
export function Breakdown({ money, paid = false }: BreakdownProps) {
  const theme = useTheme();
  return (
    <View>
      <InfoRow label="Service" value={formatPrice(money.subtotal_paise)} />
      <InfoRow label="Platform fee" value={money.platform_fee_paise ? formatPrice(money.platform_fee_paise) : 'Waived'} />
      <View style={{ height: 1, backgroundColor: theme.colors.separator, marginVertical: 6 }} />
      <InfoRow label="Total" value={formatPrice(money.total_paise)} strong />
      <InfoRow label={paid ? 'Deposit paid' : `Deposit today (${DEPOSIT_PERCENT}%)`} value={formatPrice(money.deposit_paise)} tint={theme.colors.brand} />
      <InfoRow label="Balance after the service" value={formatPrice(money.balance_paise)} />
    </View>
  );
}
