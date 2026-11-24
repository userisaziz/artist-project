import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { View } from 'react-native';
import { AppText } from '../common/AppText';
import { AppButton } from '../common/AppButton';
import { BottomSheet } from '../common/BottomSheet';
import { FormField } from '../common/FormField';
import { useTheme } from '../../core/theme/theme-provider';
import { errorMessage } from '../../core/api/error-message';
import { pricingDraftSchema, type PricingDraft } from '../../utils/artist-services/service-pricing';
import type { ServiceItem } from '../../types/artist-onboarding/artist-onboarding';
import type { ServicePricePatch } from '../../types/artist-services/artist-services';
import type { FieldDef, QuantityUnit } from '../../types/catalog/catalog';
import { PricingChooser, pricingDraftFrom, pricingPayload, type UnitPricingDraft } from '../catalog/PricingChooser';
import { DetailFieldsForm } from '../catalog/DetailFieldsForm';
import { checkAnswers, valuesFor, type FieldValues } from '../../utils/catalog/fields';

interface ServicePriceSheetProps {
  /** A service from the admin's list. Mount with a `key` per service so the fields start from it. */
  service: ServiceItem;
  /** The listing fields of the service's subcategory (what the admin asks artists to state). */
  fields: FieldDef[];
  /** The unit the service's category prices per, if it names one. */
  categoryUnit: QuantityUnit | null;
  onClose: () => void;
  onSubmit: (input: ServicePricePatch) => Promise<void>;
}

/** An approved artist's price, duration, pricing unit and details for a service from the admin's list: live at
 *  once, no review. */
export function ServicePriceSheet({ service, fields, categoryUnit, onClose, onSubmit }: ServicePriceSheetProps) {
  const theme = useTheme();
  const [error, setError] = useState<string | null>(null);
  const [pricing, setPricing] = useState<UnitPricingDraft>(() => pricingDraftFrom(service.pricing_unit, service.quantity_unit, service.min_quantity, categoryUnit));
  const [details, setDetails] = useState<FieldValues>(() => valuesFor(fields, service.attributes));
  const { control, handleSubmit, formState } = useForm<PricingDraft, unknown, ServicePricePatch>({
    resolver: zodResolver(pricingDraftSchema),
    defaultValues: { price: String(Math.round(service.price_paise / 100)), minutes: String(service.duration_minutes) },
  });

  // The schema has already turned the two fields into the patch by the time this runs.
  const save = handleSubmit(async (priceAndTime) => {
    setError(null);
    const stated = checkAnswers(fields, details);
    if (stated.error) { setError(stated.error); return; }
    const unitPricing = pricingPayload(pricing);
    if (!unitPricing.value) { setError(unitPricing.error ?? null); return; }
    try {
      await onSubmit({ ...priceAndTime, ...unitPricing.value, ...(fields.length ? { attributes: stated.answers } : {}) });
      onClose();
    } catch (e) {
      setError(errorMessage(e));
    }
  });

  return (
    <BottomSheet
      visible
      title={service.name}
      onClose={onClose}
      footer={<AppButton label="Save" onPress={() => { void save(); }} loading={formState.isSubmitting} />}
    >
      <AppText variant="caption" style={{ color: theme.colors.textSecondary, lineHeight: 19 }}>
        Customers see the new price straight away. Bookings already made keep their price.
      </AppText>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}>
          <FormField control={control} name="price" label={pricing.pricingUnit === 'per_unit' ? `Price per ${pricing.unit} (₹)` : 'Price (₹)'} keyboardType="number-pad" placeholder="2500" />
        </View>
        <View style={{ flex: 1 }}>
          <FormField control={control} name="minutes" label="Duration (minutes)" keyboardType="number-pad" placeholder="60" />
        </View>
      </View>
      <PricingChooser value={pricing} onChange={setPricing} />
      {fields.length ? <DetailFieldsForm fields={fields} values={details} onChange={setDetails} /> : null}
      {error ? <AppText variant="caption" style={{ color: theme.colors.error }}>{error}</AppText> : null}
    </BottomSheet>
  );
}
