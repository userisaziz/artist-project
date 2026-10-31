import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { View } from 'react-native';
import { AppButton } from '../common/AppButton';
import { AppText } from '../common/AppText';
import { Card } from '../common/Card';
import { DayStrip } from '../common/DayStrip';
import { FormField } from '../common/FormField';
import { Stepper } from '../common/Stepper';
import { useTheme } from '../../core/theme/theme-provider';
import { useSendQuote } from '../../hooks/quotes/quotes';
import { useNow } from '../../hooks/common/use-now';
import { errorMessage } from '../../core/api/error-message';
import { addDays, formatLongDay, istDateKey } from '../../utils/common/time';
import { formatDuration, paiseToRupeesText } from '../../utils/common/format';
import { DEFAULT_DURATION, DURATION_STEP, MAX_DURATION, MAX_NOTE, MIN_DURATION } from '../../utils/quotes/status';
import { quoteDraftSchema, type QuoteDraft, type QuoteRequest } from '../../utils/quotes/quote-draft';
import type { Enquiry, QuoteInput } from '../../types/quotes/quotes';

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
  const { control, handleSubmit } = useForm<QuoteDraft, unknown, QuoteRequest>({
    resolver: zodResolver(quoteDraftSchema),
    defaultValues: {
      price: prior ? paiseToRupeesText(prior.price_paise) : '',
      duration: prior?.duration_minutes ?? DEFAULT_DURATION,
      note: prior?.note ?? '',
      validUntil: prior?.valid_until ?? enquiry.event_date,
    },
  });
  const days = daysBetween(today, enquiry.event_date);

  const submit = handleSubmit((priced) => {
    if (send.isPending) return;
    send.mutate({ id: enquiry.id, body: payloadOf(priced) });
  });

  return (
    <Card style={{ gap: 12 }}>
      <AppText variant="subtitle" style={{ color: theme.colors.textPrimary }}>{prior ? 'Update your quote' : 'Your quote'}</AppText>
      <FormField control={control} name="price" label="Price in ₹" placeholder="e.g. 12500" keyboardType="numeric" />
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <AppText variant="label" style={{ color: theme.colors.textSecondary }}>Duration</AppText>
        <Controller
          control={control}
          name="duration"
          render={({ field }) => (
            <Stepper
              label="Duration"
              value={formatDuration(field.value)}
              canDecrease={field.value > MIN_DURATION}
              canIncrease={field.value < MAX_DURATION}
              onDecrease={() => field.onChange(Math.max(MIN_DURATION, field.value - DURATION_STEP))}
              onIncrease={() => field.onChange(Math.min(MAX_DURATION, field.value + DURATION_STEP))}
            />
          )}
        />
      </View>
      <FormField control={control} name="note" label="Note (optional)" placeholder="What’s included, travel, trial" maxLength={MAX_NOTE} />
      <Controller
        control={control}
        name="validUntil"
        render={({ field }) => (
          <View>
            <AppText variant="label" style={{ color: theme.colors.textSecondary }}>Valid until</AppText>
            <DayStrip days={days} value={field.value} onChange={field.onChange} />
            <AppText variant="caption" style={{ color: theme.colors.textMuted }}>{formatLongDay(field.value)}</AppText>
          </View>
        )}
      />
      {send.isError ? <AppText variant="caption" accessibilityRole="alert" style={{ color: theme.colors.error }}>{errorMessage(send.error)}</AppText> : null}
      {send.isSuccess && !send.isPending ? <AppText variant="caption" style={{ color: theme.colors.confirmedInk }}>Quote sent. The customer has been told.</AppText> : null}
      <AppButton label={prior ? 'Update quote' : 'Send quote'} loading={send.isPending} onPress={() => { void submit(); }} />
    </Card>
  );
}

/** The API body, from the fields once the schema has turned the price text into paise. */
function payloadOf(priced: QuoteRequest): QuoteInput {
  return {
    price_paise: priced.price,
    duration_minutes: priced.duration,
    note: priced.note.trim() || null,
    valid_until: priced.validUntil,
  };
}
