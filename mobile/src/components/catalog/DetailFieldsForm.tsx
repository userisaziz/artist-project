import { View } from 'react-native';
import { AppText } from '../common/AppText';
import { AppTextField } from '../common/AppTextField';
import { Chip } from '../common/Chip';
import { useTheme } from '../../core/theme/theme-provider';
import type { FieldDef, FieldValue } from '../../types/catalog/catalog';
import type { FieldValues } from '../../utils/catalog/fields';

interface DetailFieldsFormProps {
  /** The admin's fields for one scope (listing for the artist, booking for the customer). */
  fields: FieldDef[];
  values: FieldValues;
  onChange: (values: FieldValues) => void;
}

/** Renders a category's admin-defined fields as inputs: text boxes, number and date entry, and choice chips. */
export function DetailFieldsForm({ fields, values, onChange }: DetailFieldsFormProps) {
  const theme = useTheme();
  const set = (key: string, value: FieldValue | undefined) => onChange({ ...values, [key]: value });
  return (
    <View style={{ gap: theme.spacing[3.5] }}>
      {fields.map((f) => {
        const label = f.required ? f.label : `${f.label} (optional)`;
        const value = values[f.key];
        const hint = f.help ? <AppText variant="caption" style={{ color: theme.colors.textMuted }}>{f.help}</AppText> : null;
        if (f.type === 'select' || f.type === 'multi_select' || f.type === 'boolean') {
          const options = f.type === 'boolean' ? ['Yes', 'No'] : f.options;
          const picked = (o: string) =>
            f.type === 'multi_select' ? Array.isArray(value) && value.includes(o)
              : f.type === 'boolean' ? value === (o === 'Yes')
                : value === o;
          const toggle = (o: string) => {
            if (f.type === 'boolean') return set(f.key, value === (o === 'Yes') ? undefined : o === 'Yes');
            if (f.type === 'select') return set(f.key, value === o ? undefined : o);
            const list = Array.isArray(value) ? value : [];
            return set(f.key, list.includes(o) ? list.filter((x) => x !== o) : [...list, o]);
          };
          return (
            <View key={f.key} accessibilityRole={f.type === 'multi_select' ? undefined : 'radiogroup'} accessibilityLabel={label} style={{ gap: theme.spacing[2] }}>
              <AppText variant="label" style={{ color: theme.colors.textSecondary }}>{label}</AppText>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing[2] }}>
                {options.map((o) => <Chip key={o} label={o} selected={picked(o)} onPress={() => toggle(o)} />)}
              </View>
              {hint}
            </View>
          );
        }
        const number = f.type === 'number';
        return (
          <View key={f.key} style={{ gap: theme.spacing[1] }}>
            <AppTextField
              label={number && f.unit ? `${label} · ${f.unit}` : label}
              value={value === undefined ? '' : String(value)}
              onChangeText={(t) => {
                if (!number) return set(f.key, t);
                const cleaned = t.replace(/[^0-9.]/g, '');
                return set(f.key, cleaned === '' ? undefined : Number(cleaned));
              }}
              keyboardType={number ? 'decimal-pad' : 'default'}
              placeholder={f.type === 'date' ? 'YYYY-MM-DD' : undefined}
              multiline={f.type === 'long_text'}
              maxLength={f.type === 'long_text' ? 2000 : 300}
            />
            {hint}
          </View>
        );
      })}
    </View>
  );
}
