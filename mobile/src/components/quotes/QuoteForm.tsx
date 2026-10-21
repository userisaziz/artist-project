import { useState } from 'react';
import { View } from 'react-native';
import { AppButton } from '../common/AppButton';
import { AppText } from '../common/AppText';
import { AppTextField } from '../common/AppTextField';
import { Card } from '../common/Card';
import { DayStrip } from '../common/DayStrip';
import { Stepper } from '../common/Stepper';
import { useTheme } from '../../core/theme/theme-provider';
import { useSendQuote } from '../../hooks/quotes/quotes';
import { useNow } from '../../hooks/common/use-now';
import { errorMessage } from '../../core/api/error-message';
import { addDays, formatLongDay, istDateKey } from '../../utils/common/time';
import { formatDuration, paiseToRupeesText, rupeesToPaise } from '../../utils/common/format';
import { DEFAULT_DURATION, DURATION_STEP, MAX_DURATION, MAX_NOTE, MIN_DURATION, MIN_QUOTE_PAISE } from '../../utils/quotes/status';
import type { Enquiry } from '../../types/quotes/quotes';

/** Every IST day from `from` through `to` (empty when `to` is earlier). */
function daysBetween(from: string, to: string): string[] {
  const days: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) days.push(d);
  return days;
}

/** The artist's price, duration, note and how long the quote stands; prefilled from an earlier quote. */
export function QuoteForm({ enquiry }: { enquiry: Enquiry }) {
  const theme = useTheme();
  const today = istDateKey(useNow());
  const send = useSendQuote();
  const prior = enquiry.quote;
  const [price, setPrice] = useState(prior ? paiseToRupeesText(prior.price_paise) : '');
  const [duration, setDuration] = useState(prior?.duration_minutes ?? DEFAULT_DURATION);
  const [note, setNote] = useState(prior?.note ?? '');
  const [validUntil, setValidUntil] = useState(prior?.valid_until ?? enquiry.event_date);
  const [problem, setProblem] = useState<string | null>(null);
  const days = daysBetween(today, enquiry.event_date);

  const submit = () => {
    if (send.isPending) return;
    const pricePaise = rupeesToPaise(price);
    if (!pricePaise || pricePaise < MIN_QUOTE_PAISE) { setProblem('Enter your price in rupees.'); return; }
    setProblem(null);
    send.mutate({ id: enquiry.id, body: { price_paise: pricePaise, duration_minutes: duration, note: note.trim() || null, valid_until: validUntil } });
  };
  const error = problem ?? (send.error ? errorMessage(send.error) : null);

  return (
    <Card style={{ gap: 12 }}>
      <AppText variant="subtitle" style={{ color: theme.colors.textPrimary }}>{prior ? 'Update your quote' : 'Your quote'}</AppText>
      <AppTextField label="Price in ₹" placeholder="e.g. 12500" keyboardType="numeric" value={price} onChangeText={(v) => { setPrice(v); setProblem(null); }} />
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <AppText variant="label" style={{ color: theme.colors.textSecondary }}>Duration</AppText>
        <Stepper
          label="Duration"
          value={formatDuration(duration)}
          canDecrease={duration > MIN_DURATION}
          canIncrease={duration < MAX_DURATION}
          onDecrease={() => setDuration((d) => Math.max(MIN_DURATION, d - DURATION_STEP))}
          onIncrease={() => setDuration((d) => Math.min(MAX_DURATION, d + DURATION_STEP))}
        />
      </View>
      <AppTextField label="Note (optional)" placeholder="What’s included, travel, trial" value={note} onChangeText={setNote} maxLength={MAX_NOTE} />
      <View>
        <AppText variant="label" style={{ color: theme.colors.textSecondary }}>Valid until</AppText>
        <DayStrip days={days} value={validUntil} onChange={setValidUntil} />
        <AppText variant="caption" style={{ color: theme.colors.textMuted }}>{formatLongDay(validUntil)}</AppText>
      </View>
      {error ? <AppText variant="caption" accessibilityRole="alert" style={{ color: theme.colors.error }}>{error}</AppText> : null}
      {send.isSuccess && !send.isPending ? <AppText variant="caption" style={{ color: theme.colors.confirmedInk }}>Quote sent. The customer has been told.</AppText> : null}
      <AppButton label={prior ? 'Update quote' : 'Send quote'} loading={send.isPending} onPress={submit} />
    </Card>
  );
}
