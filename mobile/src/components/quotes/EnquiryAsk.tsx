import { View } from 'react-native';
import { AppText } from '../common/AppText';
import { Card } from '../common/Card';
import { InfoRow } from '../common/InfoRow';
import { useTheme } from '../../core/theme/theme-provider';
import { formatLongDay } from '../../utils/common/time';
import { formatPrice } from '../../utils/common/format';
import type { Enquiry } from '../../types/quotes/quotes';
import { AnswerList } from '../catalog/AnswerList';
import { countLabel } from '../../utils/catalog/units';

/** What the customer asked for: the service and how many (when about one), the event date, their answers, details
 *  and budget. */
export function EnquiryAsk({ enquiry }: { enquiry: Enquiry }) {
  const theme = useTheme();
  return (
    <Card style={{ gap: 6 }}>
      {enquiry.service_name ? <InfoRow label="Service" value={enquiry.service_name} /> : null}
      {enquiry.quantity ? <InfoRow label="How many" value={enquiry.quantity_unit ? countLabel(enquiry.quantity, enquiry.quantity_unit) : String(enquiry.quantity)} /> : null}
      {enquiry.addons.map((a) => (
        <InfoRow key={a.name} label={`+ ${a.per_person ? `${a.name} × ${a.guests}` : a.name}`} value={formatPrice(a.line_paise)} />
      ))}
      {enquiry.also_services.length ? <InfoRow label="Also asking about" value={enquiry.also_services.map((s) => s.name).join(', ')} /> : null}
      <InfoRow label="Event date" value={formatLongDay(enquiry.event_date)} />
      <InfoRow label="Budget" value={enquiry.budget_paise === null ? 'Not given' : formatPrice(enquiry.budget_paise)} />
      {enquiry.answers.length ? <View style={{ marginTop: theme.spacing[1] }}><AnswerList title="Details" answers={enquiry.answers} /></View> : null}
      <View style={{ marginTop: 4, borderRadius: theme.radii.md, backgroundColor: theme.colors.washTop, padding: 12 }}>
        <AppText variant="caption" style={{ color: theme.colors.textMuted }}>What they need</AppText>
        <AppText variant="body" style={{ color: theme.colors.textSecondary }}>{enquiry.details}</AppText>
      </View>
    </Card>
  );
}
