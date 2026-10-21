import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppButton } from '../common/AppButton';
import { AppText } from '../common/AppText';
import { AppTextField } from '../common/AppTextField';
import { BackHeader } from '../common/BackHeader';
import { DayStrip } from '../common/DayStrip';
import { useTheme } from '../../core/theme/theme-provider';
import { useCreateEnquiry } from '../../hooks/quotes/quotes';
import { useNow } from '../../hooks/common/use-now';
import { errorMessage } from '../../core/api/error-message';
import { addDays, formatLongDay, istDateKey } from '../../utils/common/time';
import { rupeesToPaise } from '../../utils/common/format';
import { EVENT_WINDOW_DAYS, MAX_DETAILS, MIN_DETAILS } from '../../utils/quotes/status';

const DETAILS_HEIGHT = 120;

interface EnquiryFormProps {
  artistId: string;
  /** Shown in the intro once the artist has loaded. */
  artistName?: string;
  onSent: (enquiryId: string) => void;
}

/** Ask an artist for a custom quote: the event date, what's needed and an optional budget. */
export function EnquiryForm({ artistId, artistName, onSent }: EnquiryFormProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const today = istDateKey(useNow());
  const create = useCreateEnquiry();
  const [eventDate, setEventDate] = useState<string | null>(null);
  const [details, setDetails] = useState('');
  const [budget, setBudget] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const days = Array.from({ length: EVENT_WINDOW_DAYS }, (_, i) => addDays(today, i));
  const budgetPaise = budget.trim() ? rupeesToPaise(budget) : null;

  const send = () => {
    if (create.isPending) return;
    if (!eventDate) { setProblem('Pick the date of your event.'); return; }
    if (details.trim().length < MIN_DETAILS) { setProblem(`Tell the artist a little more (at least ${MIN_DETAILS} characters).`); return; }
    if (budget.trim() && !budgetPaise) { setProblem('Enter the budget in rupees, or leave it empty.'); return; }
    setProblem(null);
    // A refusal (e.g. an open enquiry with this artist already) lands in create.error, shown below.
    create.mutate({ artist_id: artistId, event_date: eventDate, details: details.trim(), budget_paise: budgetPaise }, { onSuccess: (enquiry) => onSent(enquiry.id) });
  };
  const error = problem ?? (create.error ? errorMessage(create.error) : null);

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingTop: insets.top + theme.spacing.sm, paddingHorizontal: theme.spacing.md, paddingBottom: 120 + insets.bottom, gap: 12 }}>
        <BackHeader title="Request a quote" />
        <AppText variant="body" style={{ color: theme.colors.textSecondary }}>
          {artistName ? `Tell ${artistName} what you need and they’ll send you a price.` : 'Tell the artist what you need and they’ll send you a price.'}
        </AppText>
        <View>
          <AppText variant="label" style={{ color: theme.colors.textSecondary }}>Event date</AppText>
          <DayStrip days={days} value={eventDate} onChange={(d) => { setEventDate(d); setProblem(null); }} />
          <AppText variant="caption" style={{ color: theme.colors.textMuted }}>{eventDate ? formatLongDay(eventDate) : 'Pick a date'}</AppText>
        </View>
        <View>
          <AppTextField
            label="What do you need?"
            placeholder="The occasion, how many people, the look you want"
            value={details}
            onChangeText={(v) => { setDetails(v); setProblem(null); }}
            maxLength={MAX_DETAILS}
            multiline
            style={{ height: DETAILS_HEIGHT, paddingTop: 12, textAlignVertical: 'top' }}
          />
          <AppText variant="caption" style={{ color: theme.colors.textMuted, textAlign: 'right', marginTop: 4 }}>{`${details.length}/${MAX_DETAILS}`}</AppText>
        </View>
        <AppTextField
          label="Budget in ₹ (optional)"
          placeholder="e.g. 10000"
          keyboardType="numeric"
          value={budget}
          onChangeText={(v) => { setBudget(v); setProblem(null); }}
        />
        {error ? <AppText variant="caption" accessibilityRole="alert" style={{ color: theme.colors.error }}>{error}</AppText> : null}
      </ScrollView>
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: theme.spacing.md, paddingTop: 12, paddingBottom: insets.bottom + 12, backgroundColor: theme.colors.surface, borderTopWidth: 1, borderTopColor: theme.colors.separator }}>
        <AppButton label="Send" loading={create.isPending} onPress={send} />
      </View>
    </View>
  );
}
