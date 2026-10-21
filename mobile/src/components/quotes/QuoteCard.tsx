import type { ReactNode } from 'react';
import { AppText } from '../common/AppText';
import { Card } from '../common/Card';
import { InfoRow } from '../common/InfoRow';
import { useTheme } from '../../core/theme/theme-provider';
import { formatDuration, formatPrice } from '../../utils/common/format';
import { formatDay } from '../../utils/common/time';
import type { EnquiryQuote } from '../../types/quotes/quotes';

interface QuoteCardProps {
  quote: EnquiryQuote;
  title?: string;
  /** Actions under the quote, e.g. Accept / Withdraw. */
  children?: ReactNode;
}

/** The artist's quote: price, duration, their note and how long it stands. */
export function QuoteCard({ quote, title = 'The quote', children }: QuoteCardProps) {
  const theme = useTheme();
  return (
    <Card style={{ gap: 4 }}>
      <AppText variant="subtitle" style={{ color: theme.colors.textPrimary }}>{title}</AppText>
      <InfoRow label="Price" value={formatPrice(quote.price_paise)} strong tint={theme.colors.brand} />
      <InfoRow label="Duration" value={formatDuration(quote.duration_minutes)} />
      <InfoRow label="Valid until" value={formatDay(quote.valid_until)} />
      {quote.note ? <AppText variant="body" style={{ color: theme.colors.textSecondary, marginTop: 4 }}>{quote.note}</AppText> : null}
      {children}
    </Card>
  );
}
