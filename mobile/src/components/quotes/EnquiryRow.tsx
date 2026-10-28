import { View } from 'react-native';
import { PressableFeedback } from '../common/PressableFeedback';
import { AppText } from '../common/AppText';
import { StatusPill, type PillTone } from '../common/StatusPill';
import { useTheme } from '../../core/theme/theme-provider';
import { formatDay } from '../../utils/common/time';
import { formatPrice } from '../../utils/common/format';
import type { Enquiry } from '../../types/quotes/quotes';

interface EnquiryRowProps {
  enquiry: Enquiry;
  /** Who it's with: the artist for the customer, the customer for the artist. */
  title: string;
  pill: { label: string; tone: PillTone };
  onPress: () => void;
}

/** One enquiry in a list: who, the event date, where it stands and the quoted price once there is one. */
export function EnquiryRow({ enquiry, title, pill, onPress }: EnquiryRowProps) {
  const theme = useTheme();
  const when = formatDay(enquiry.event_date);
  const price = enquiry.quote ? ` · ${formatPrice(enquiry.quote.price_paise)}` : '';
  return (
    <PressableFeedback
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${when}, ${pill.label}${price}`}
      onPress={onPress}
      style={{ borderRadius: theme.radii.card, borderWidth: 1, borderColor: theme.colors.separator, padding: 14, gap: 6 }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <AppText variant="label" numberOfLines={1} style={{ flex: 1, color: theme.colors.textPrimary }}>{title}</AppText>
        <StatusPill label={pill.label} tone={pill.tone} />
      </View>
      <AppText variant="caption" style={{ color: theme.colors.textMuted }}>{`Event ${when}${price}`}</AppText>
      <AppText variant="caption" numberOfLines={2} style={{ color: theme.colors.textSecondary }}>{enquiry.details}</AppText>
    </PressableFeedback>
  );
}
