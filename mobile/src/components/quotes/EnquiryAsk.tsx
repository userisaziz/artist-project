import { View } from 'react-native';
import { AppText } from '../common/AppText';
import { Card } from '../common/Card';
import { InfoRow } from '../common/InfoRow';
import { useTheme } from '../../core/theme/theme-provider';
import { formatLongDay } from '../../utils/common/time';
import { formatPrice } from '../../utils/common/format';
import type { Enquiry } from '../../types/quotes/quotes';

/** What the customer asked for: the event date, their details and budget. */
export function EnquiryAsk({ enquiry }: { enquiry: Enquiry }) {
  const theme = useTheme();
  return (
    <Card style={{ gap: 6 }}>
      <InfoRow label="Event date" value={formatLongDay(enquiry.event_date)} />
      <InfoRow label="Budget" value={enquiry.budget_paise === null ? 'Not given' : formatPrice(enquiry.budget_paise)} />
      <View style={{ marginTop: 4, borderRadius: theme.radii.md, backgroundColor: theme.colors.washTop, padding: 12 }}>
        <AppText variant="caption" style={{ color: theme.colors.textMuted }}>What they need</AppText>
        <AppText variant="body" style={{ color: theme.colors.textSecondary }}>{enquiry.details}</AppText>
      </View>
    </Card>
  );
}
