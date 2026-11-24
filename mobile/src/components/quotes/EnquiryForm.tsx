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
import type { PublicService } from '../../types/directory/directory';
import type { BookingAddonPick } from '../../types/bookings/bookings';
import { QuantityPicker } from '../common/QuantityPicker';
import { AddonPicker } from '../directory/AddonPicker';
import { SuggestedServices } from '../directory/SuggestedServices';
import { MAX_QUANTITY, countLabel, unitWord } from '../../utils/catalog/units';
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
  /** The service asked about (a made-to-order one): its name, unit and minimum, add-ons and the questions its
   *  category asks customers. */
  service?: QuotedService;
  /** More of the artist's services the customer can tick to be quoted together. */
  suggestions?: PublicService[];
  /** What was already picked on Service detail. */
  initial?: { quantity?: number; addons?: BookingAddonPick[] };
  onSent: (enquiryId: string) => void;
}

type QuotedService = Pick<PublicService, 'id' | 'name' | 'booking_fields' | 'pricing_unit' | 'quantity_unit' | 'min_quantity' | 'addons'>;

/** Ask an artist for a custom quote: the event date, what's needed and an optional budget. About one service, it
 *  also asks how many (in its unit, from its minimum), its add-ons, its questions ("Baby's name"), and which of the
 *  artist's other services to price in the same quote. */
export function EnquiryForm({ artistId, artistName, service, suggestions = [], initial, onSent }: EnquiryFormProps) {
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
  const perUnit = service?.pricing_unit === 'per_unit';
  // Per unit: a count from the minimum. Otherwise how many is optional free entry ("40 cards").
  const [unitCount, setUnitCount] = useState(Math.max(initial?.quantity ?? 0, service?.min_quantity ?? 1));
  const [quantity, setQuantity] = useState('');
  const [picks, setPicks] = useState<BookingAddonPick[]>(initial?.addons ?? []);
  const [also, setAlso] = useState<string[]>([]);
  const [answers, setAnswers] = useState<FieldValues>({});
  const [extraError, setExtraError] = useState<string | null>(null);

  // Only what the schema can't know is assembled here: which artist, and the budget as paise (null when
  // the field is empty). Everything it does know — the messages, the trim, the send-gate — is the schema's.
  const send = handleSubmit((draft) => {
    if (create.isPending) return;
    const count = perUnit ? unitCount : quantity.trim() ? Number(quantity) : null;
    if (count !== null && (!Number.isInteger(count) || count < 1 || count > MAX_QUANTITY)) {
      setExtraError(`Enter how many as a whole number up to ${MAX_QUANTITY.toLocaleString('en-IN')}`);
      return;
    }
    const asked = checkAnswers(service?.booking_fields ?? [], answers);
    setExtraError(asked.error);
    if (asked.error) return;
    // A refusal (e.g. an open enquiry with this artist already) lands in create.error, shown below.
    create.mutate(
      {
        artist_id: artistId, event_date: draft.eventDate, details: draft.details, budget_paise: rupeesToPaise(draft.budget),
        ...(service ? { service_id: service.id, quantity: count, answers: asked.answers, addons: picks, also_service_ids: also } : {}),
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
            {perUnit ? (
              <View style={{ gap: theme.spacing[2] }}>
                <AppText variant="label" style={{ color: theme.colors.textSecondary }}>{`How many ${unitWord(service.quantity_unit, 2)}?`}</AppText>
                <QuantityPicker value={unitCount} min={service.min_quantity} max={MAX_QUANTITY} noun={(n) => unitWord(service.quantity_unit, n)} onChange={setUnitCount} />
                {service.min_quantity > 1 ? <AppText variant="caption" style={{ color: theme.colors.textMuted }}>{`Minimum ${countLabel(service.min_quantity, service.quantity_unit)}.`}</AppText> : null}
              </View>
            ) : (
              <AppTextField label="How many? (optional)" placeholder="e.g. 40" value={quantity} onChangeText={(t) => { setQuantity(t.replace(/[^0-9]/g, '')); setExtraError(null); }} keyboardType="number-pad" />
            )}
            {service.addons.length ? (
              <View style={{ gap: theme.spacing[2] }}>
                <AppText variant="label" style={{ color: theme.colors.textSecondary }}>Add-ons</AppText>
                <AddonPicker addons={service.addons} picks={picks} onChange={setPicks} />
              </View>
            ) : null}
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
        {service ? (
          <SuggestedServices
            services={suggestions}
            picked={also}
            onToggle={(s) => setAlso((now) => (now.includes(s.id) ? now.filter((id) => id !== s.id) : [...now, s.id]))}
          />
        ) : null}
        {extraError ? <AppText variant="caption" accessibilityRole="alert" style={{ color: theme.colors.error }}>{extraError}</AppText> : null}
        {create.error ? <AppText variant="caption" accessibilityRole="alert" style={{ color: theme.colors.error }}>{errorMessage(create.error)}</AppText> : null}
      </ScrollView>
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: theme.spacing.md, paddingTop: 12, paddingBottom: insets.bottom + 12, backgroundColor: theme.colors.surface, borderTopWidth: 1, borderTopColor: theme.colors.separator }}>
        <AppButton label="Send" loading={create.isPending} onPress={() => { void send(); }} />
      </View>
    </View>
  );
}
