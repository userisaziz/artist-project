import { useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppButton } from '../common/AppButton';
import { AppText } from '../common/AppText';
import { BackHeader } from '../common/BackHeader';
import { DayStrip } from '../common/DayStrip';
import { FormField } from '../common/FormField';
import { AppTextField } from '../common/AppTextField';
import { DetailFieldsForm } from '../catalog/DetailFieldsForm';
import { checkAnswers, type FieldValues } from '../../utils/catalog/fields';
import type { FieldDef } from '../../types/catalog/catalog';
import { useTheme } from '../../core/theme/theme-provider';
import { useCreateEnquiry } from '../../hooks/quotes/quotes';
import { useNow } from '../../hooks/common/use-now';
import { errorMessage } from '../../core/api/error-message';
import { addDays, formatLongDay, istDateKey } from '../../utils/common/time';
import { rupeesToPaise } from '../../utils/common/format';
import { EVENT_WINDOW_DAYS, MAX_DETAILS } from '../../utils/quotes/status';
import { enquiryDraftSchema, type EnquiryDraft } from '../../utils/quotes/enquiry-draft';

const DETAILS_HEIGHT = 120;

interface EnquiryFormProps {
  artistId: string;
  /** Shown in the intro once the artist has loaded. */
  artistName?: string;
  /** The service asked about (a made-to-order one): its name, and the questions its category asks customers. */
  service?: { id: string; name: string; booking_fields: FieldDef[] };
  onSent: (enquiryId: string) => void;
}

const QUANTITY_MAX = 10_000; // backend app/quote/constants.py

/** Ask an artist for a custom quote: the event date, what's needed and an optional budget. About one service, it
 *  also asks how many and that service's questions ("Baby's name"). */
export function EnquiryForm({ artistId, artistName, service, onSent }: EnquiryFormProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const today = istDateKey(useNow());
  const create = useCreateEnquiry();
  const { control, handleSubmit } = useForm<EnquiryDraft>({
    resolver: zodResolver(enquiryDraftSchema),
    defaultValues: { eventDate: '', details: '', budget: '' },
  });
  const days = Array.from({ length: EVENT_WINDOW_DAYS }, (_, i) => addDays(today, i));
  // Only the counter subscribes, and only to the details field: watch() would re-render on every keystroke
  // in the budget too.
  const details = useWatch({ control, name: 'details' }) ?? '';
  const [quantity, setQuantity] = useState('');
  const [answers, setAnswers] = useState<FieldValues>({});
  const [extraError, setExtraError] = useState<string | null>(null);

  // Only what the schema can't know is assembled here: which artist, and the budget as paise (null when
  // the field is empty). Everything it does know — the messages, the trim, the send-gate — is the schema's.
  const send = handleSubmit((draft) => {
    if (create.isPending) return;
    const count = quantity.trim() ? Number(quantity) : null;
    if (count !== null && (!Number.isInteger(count) || count < 1 || count > QUANTITY_MAX)) {
      setExtraError(`Enter how many as a whole number up to ${QUANTITY_MAX.toLocaleString('en-IN')}`);
      return;
    }
    const asked = checkAnswers(service?.booking_fields ?? [], answers);
    setExtraError(asked.error);
    if (asked.error) return;
    // A refusal (e.g. an open enquiry with this artist already) lands in create.error, shown below.
    create.mutate(
      {
        artist_id: artistId, event_date: draft.eventDate, details: draft.details, budget_paise: rupeesToPaise(draft.budget),
        ...(service ? { service_id: service.id, quantity: count, answers: asked.answers } : {}),
      },
      { onSuccess: (enquiry) => onSent(enquiry.id) },
    );
  });

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingTop: insets.top + theme.spacing.sm, paddingHorizontal: theme.spacing.md, paddingBottom: 120 + insets.bottom, gap: 12 }}>
        <BackHeader title="Request a quote" />
        <AppText variant="body" style={{ color: theme.colors.textSecondary }}>
          {artistName ? `Tell ${artistName} what you need and they’ll send you a price.` : 'Tell the artist what you need and they’ll send you a price.'}
        </AppText>
        <Controller
          control={control}
          name="eventDate"
          render={({ field, fieldState }) => (
            <View>
              <AppText variant="label" style={{ color: theme.colors.textSecondary }}>Event date</AppText>
              <DayStrip days={days} value={field.value} onChange={field.onChange} />
              <AppText variant="caption" style={{ color: theme.colors.textMuted }}>{field.value ? formatLongDay(field.value) : 'Pick a date'}</AppText>
              {fieldState.error ? <AppText variant="caption" accessibilityRole="alert" style={{ color: theme.colors.error }}>{fieldState.error.message}</AppText> : null}
            </View>
          )}
        />
        {service ? (
          <View style={{ gap: theme.spacing[3] }}>
            <View style={{ borderRadius: theme.radii.md, backgroundColor: theme.colors.brandSoft, padding: theme.spacing[3] }}>
              <AppText variant="caption" style={{ color: theme.colors.textMuted }}>About</AppText>
              <AppText variant="label" style={{ color: theme.colors.textPrimary }}>{service.name}</AppText>
            </View>
            <AppTextField label="How many? (optional)" placeholder="e.g. 40 boxes" value={quantity} onChangeText={(t) => { setQuantity(t.replace(/[^0-9]/g, '')); setExtraError(null); }} keyboardType="number-pad" />
            {service.booking_fields.length ? <DetailFieldsForm fields={service.booking_fields} values={answers} onChange={(v) => { setAnswers(v); setExtraError(null); }} /> : null}
          </View>
        ) : null}
        <View>
          <FormField
            control={control}
            name="details"
            label="What do you need?"
            placeholder="The occasion, how many people, the look you want"
            maxLength={MAX_DETAILS}
            multiline
            style={{ height: DETAILS_HEIGHT, paddingTop: 12, textAlignVertical: 'top' }}
          />
          <AppText variant="caption" style={{ color: theme.colors.textMuted, textAlign: 'right', marginTop: 4 }}>{`${details.length}/${MAX_DETAILS}`}</AppText>
        </View>
        <FormField
          control={control}
          name="budget"
          label="Budget in ₹ (optional)"
          placeholder="e.g. 10000"
          keyboardType="numeric"
        />
        {extraError ? <AppText variant="caption" accessibilityRole="alert" style={{ color: theme.colors.error }}>{extraError}</AppText> : null}
        {create.error ? <AppText variant="caption" accessibilityRole="alert" style={{ color: theme.colors.error }}>{errorMessage(create.error)}</AppText> : null}
      </ScrollView>
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: theme.spacing.md, paddingTop: 12, paddingBottom: insets.bottom + 12, backgroundColor: theme.colors.surface, borderTopWidth: 1, borderTopColor: theme.colors.separator }}>
        <AppButton label="Send" loading={create.isPending} onPress={() => { void send(); }} />
      </View>
    </View>
  );
}
