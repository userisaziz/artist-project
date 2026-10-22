import { Pressable, View } from 'react-native';
import { AppText } from '../common/AppText';
import { Icon } from '../common/Icon';
import { useTheme } from '../../core/theme/theme-provider';
import { formatPrice } from '../../utils/common/format';
import { MAX_ADDON_GUESTS } from '../../utils/bookings/addons';
import type { BookingAddonPick } from '../../types/bookings/bookings';
import type { ServiceAddon } from '../../types/catalog/catalog';

interface AddonPickerProps {
  addons: ServiceAddon[];
  picks: BookingAddonPick[];
  onChange: (picks: BookingAddonPick[]) => void;
}

const BOX = 22;
const STEP = 30;

/** Service detail "Add-ons": tick any; per-person ones get a guest count. Picks keep the service's order. */
export function AddonPicker({ addons, picks, onChange }: AddonPickerProps) {
  const theme = useTheme();
  const guestsOf = (id: string) => picks.find((p) => p.addon_id === id)?.guests;
  const toggle = (addon: ServiceAddon) => {
    const next = guestsOf(addon.id) ? picks.filter((p) => p.addon_id !== addon.id) : [...picks, { addon_id: addon.id, guests: 1 }];
    onChange(addons.flatMap((a) => next.filter((p) => p.addon_id === a.id)));
  };
  const setGuests = (id: string, guests: number) => onChange(picks.map((p) => (p.addon_id === id ? { ...p, guests } : p)));

  return (
    <View style={{ borderRadius: theme.radii.card, borderWidth: 1, borderColor: theme.colors.separator, overflow: 'hidden' }}>
      {addons.map((a, i) => {
        const guests = guestsOf(a.id);
        const on = guests !== undefined;
        const price = `+${formatPrice(a.price_paise)}${a.per_person ? ' / person' : ''}`;
        return (
          <View key={a.id} style={{ paddingHorizontal: 14, paddingVertical: 12, gap: 10, borderTopWidth: i ? 1 : 0, borderTopColor: theme.colors.separator }}>
            <Pressable
              accessibilityRole="checkbox"
              accessibilityLabel={`${a.name}, ${price}`}
              accessibilityState={{ checked: on }}
              onPress={() => toggle(a)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}
            >
              <View style={{ width: BOX, height: BOX, borderRadius: 6, alignItems: 'center', justifyContent: 'center', borderWidth: on ? 0 : 1.5, borderColor: theme.colors.border, backgroundColor: on ? theme.colors.brand : theme.colors.surface }}>
                {on ? <Icon name="check" size={14} color={theme.colors.textOnBrand} /> : null}
              </View>
              <AppText variant="label" style={{ flex: 1, color: theme.colors.textPrimary }}>{a.name}</AppText>
              <AppText variant="label" style={{ color: theme.colors.brand }}>{price}</AppText>
            </Pressable>
            {on && a.per_person ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingLeft: BOX + 12 }}>
                <StepButton icon="minus" label={`Fewer guests for ${a.name}`} enabled={guests > 1} onPress={() => setGuests(a.id, guests - 1)} />
                <AppText variant="label" style={{ minWidth: 64, textAlign: 'center', color: theme.colors.textPrimary }}>{`${guests} ${guests === 1 ? 'guest' : 'guests'}`}</AppText>
                <StepButton icon="plus" label={`More guests for ${a.name}`} enabled={guests < MAX_ADDON_GUESTS} onPress={() => setGuests(a.id, guests + 1)} />
              </View>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

function StepButton({ icon, label, enabled, onPress }: { icon: 'minus' | 'plus'; label: string; enabled: boolean; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !enabled }}
      disabled={!enabled}
      onPress={onPress}
      hitSlop={6}
      style={{ width: STEP, height: STEP, borderRadius: STEP / 2, borderWidth: 1, borderColor: theme.colors.separator, alignItems: 'center', justifyContent: 'center', opacity: enabled ? 1 : 0.4 }}
    >
      <Icon name={icon} size={14} />
    </Pressable>
  );
}
