import { useState } from 'react';
import { View } from 'react-native';
import { AppText } from '../common/AppText';
import { AppButton } from '../common/AppButton';
import { AppTextField } from '../common/AppTextField';
import { BottomSheet } from '../common/BottomSheet';
import { useTheme } from '../../core/theme/theme-provider';
import { errorMessage } from '../../core/api/error-message';
import type { ServiceItem } from '../../types/artist-onboarding/artist-onboarding';
import type { ServicePricePatch } from '../../types/artist-services/artist-services';

const MAX_RUPEES = 1_000_000; // price_paise ≤ 100 000 000
const MAX_MINUTES = 1440;

interface ServicePriceSheetProps {
  /** A service from the admin's list. Mount with a `key` per service so the fields start from it. */
  service: ServiceItem;
  onClose: () => void;
  onSubmit: (input: ServicePricePatch) => Promise<void>;
}

/** An approved artist's price and duration for a service from the admin's list: live at once, no review. */
export function ServicePriceSheet({ service, onClose, onSubmit }: ServicePriceSheetProps) {
  const theme = useTheme();
  const [price, setPrice] = useState(String(Math.round(service.price_paise / 100)));
  const [minutes, setMinutes] = useState(String(service.duration_minutes));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  /** The input, or a message for the first problem. */
  const validate = (): ServicePricePatch | string => {
    const rupees = Number(price);
    const mins = Number(minutes);
    if (!Number.isInteger(rupees) || rupees <= 0 || rupees > MAX_RUPEES) return 'Enter a price above ₹0.';
    if (!Number.isInteger(mins) || mins <= 0 || mins > MAX_MINUTES) return 'Enter a duration between 1 and 1440 minutes.';
    return { price_paise: rupees * 100, duration_minutes: mins };
  };

  const save = async () => {
    const input = validate();
    if (typeof input === 'string') { setError(input); return; }
    setSaving(true);
    setError(null);
    try {
      await onSubmit(input);
      onClose();
    } catch (e) {
      setError(errorMessage(e));
      setSaving(false);
    }
  };

  return (
    <BottomSheet
      visible
      title={service.name}
      onClose={onClose}
      footer={<AppButton label="Save" onPress={() => { void save(); }} loading={saving} />}
    >
      <AppText variant="caption" style={{ color: theme.colors.textSecondary, lineHeight: 19 }}>
        Customers see the new price straight away. Bookings already made keep their price.
      </AppText>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}>
          <AppTextField label="Price (₹)" value={price} onChangeText={setPrice} keyboardType="number-pad" placeholder="2500" />
        </View>
        <View style={{ flex: 1 }}>
          <AppTextField label="Duration (minutes)" value={minutes} onChangeText={setMinutes} keyboardType="number-pad" placeholder="60" />
        </View>
      </View>
      {error ? <AppText variant="caption" style={{ color: theme.colors.error }}>{error}</AppText> : null}
    </BottomSheet>
  );
}
