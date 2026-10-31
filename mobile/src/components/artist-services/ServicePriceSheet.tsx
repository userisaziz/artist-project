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

interface ServicePriceSheetProps {
  /** A service from the admin's list. Mount with a `key` per service so the fields start from it. */
  service: ServiceItem;
  onClose: () => void;
  onSubmit: (input: ServicePricePatch) => Promise<void>;
}

/** An approved artist's price and duration for a service from the admin's list: live at once, no review. */
export function ServicePriceSheet({ service, onClose, onSubmit }: ServicePriceSheetProps) {
  const theme = useTheme();
  const [error, setError] = useState<string | null>(null);
  const { control, handleSubmit, formState } = useForm<PricingDraft, unknown, ServicePricePatch>({
    resolver: zodResolver(pricingDraftSchema),
    defaultValues: { price: String(Math.round(service.price_paise / 100)), minutes: String(service.duration_minutes) },
  });

  // The schema has already turned the two fields into the patch by the time this runs.
  const save = handleSubmit(async (pricing) => {
    setError(null);
    try {
      await onSubmit(pricing);
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
          <FormField control={control} name="price" label="Price (₹)" keyboardType="number-pad" placeholder="2500" />
        </View>
        <View style={{ flex: 1 }}>
          <FormField control={control} name="minutes" label="Duration (minutes)" keyboardType="number-pad" placeholder="60" />
        </View>
      </View>
      {error ? <AppText variant="caption" style={{ color: theme.colors.error }}>{error}</AppText> : null}
    </BottomSheet>
  );
}
