import { View } from 'react-native';
import { AppText } from '../common/AppText';
import { AppTextField } from '../common/AppTextField';
import { Chip } from '../common/Chip';
import { Segmented } from '../common/Segmented';
import { useTheme } from '../../core/theme/theme-provider';
import { QUANTITY_UNITS, unitTitle, unitWord } from '../../utils/catalog/units';
import type { PricingUnit, QuantityUnit } from '../../types/catalog/catalog';

export interface UnitPricingDraft {
  pricingUnit: PricingUnit;
  unit: QuantityUnit;
  /** As typed; checked on save. */
  minQuantity: string;
}

/** The pricing to start from: a whole-service price, counted in the category's unit (a piece without one) if
 *  the artist switches to per unit. */
export function pricingDraftFrom(pricingUnit: PricingUnit, unit: QuantityUnit | null, min: number, categoryUnit: QuantityUnit | null): UnitPricingDraft {
  return { pricingUnit, unit: unit ?? categoryUnit ?? 'piece', minQuantity: String(min) };
}

/** What the draft sends, or the problem with the minimum. */
export function pricingPayload(d: UnitPricingDraft): { value?: { pricing_unit: PricingUnit; quantity_unit: QuantityUnit | null; min_quantity: number }; error?: string } {
  if (d.pricingUnit === 'package') return { value: { pricing_unit: 'package', quantity_unit: null, min_quantity: 1 } };
  const min = Number(d.minQuantity);
  if (!Number.isInteger(min) || min < 1 || min > 1000) return { error: 'Enter a minimum between 1 and 1000.' };
  return { value: { pricing_unit: 'per_unit', quantity_unit: d.unit, min_quantity: min } };
}

/** How a service is priced: as a whole, or per person / piece / box / card / hour / set from a minimum. */
export function PricingChooser({ value, onChange }: { value: UnitPricingDraft; onChange: (value: UnitPricingDraft) => void }) {
  const theme = useTheme();
  const perUnit = value.pricingUnit === 'per_unit';
  return (
    <View style={{ gap: theme.spacing[2.5] }}>
      <Segmented
        options={[{ key: 'package', label: 'Whole service' }, { key: 'per_unit', label: 'Per unit' }]}
        value={value.pricingUnit}
        onChange={(pricingUnit) => onChange({ ...value, pricingUnit })}
      />
      {perUnit ? (
        <>
          <View accessibilityRole="radiogroup" accessibilityLabel="Priced per" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing[2] }}>
            {QUANTITY_UNITS.map((u) => <Chip key={u} label={unitTitle(u)} selected={value.unit === u} onPress={() => onChange({ ...value, unit: u })} />)}
          </View>
          <AppTextField
            label={`Minimum ${unitWord(value.unit, 2)}`}
            value={value.minQuantity}
            onChangeText={(t) => onChange({ ...value, minQuantity: t.replace(/[^0-9]/g, '') })}
            keyboardType="number-pad"
            maxLength={4}
          />
          <AppText variant="caption" style={{ color: theme.colors.textMuted }}>
            {`The price is for one ${value.unit}; customers pick how many, from the minimum.`}
          </AppText>
        </>
      ) : null}
    </View>
  );
}
