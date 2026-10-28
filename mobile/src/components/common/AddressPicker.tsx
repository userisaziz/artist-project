import { ScrollView, Switch, View } from 'react-native';
import { AppText } from './AppText';
import { Chip } from './Chip';
import { useTheme } from '../../core/theme/theme-provider';

export interface AddressChoice { id: string; label: string; address: string }

/** Route-supplied address book for an address field: the saved addresses, and what to do once one is used. */
export interface AddressBook {
  choices: AddressChoice[];
  /** After a booking or order succeeds: mark the picked one used, or save a newly typed one when `remember` is on. */
  afterUse: (address: string, pickedId: string | null, remember: boolean) => void;
}

interface AddressPickerProps {
  choices: AddressChoice[];
  pickedId: string | null;
  onPick: (choice: AddressChoice) => void;
  /** Shown while the address is typed rather than picked. */
  remember: boolean;
  onRememberChange: (remember: boolean) => void;
}

/** Saved addresses as chips above an address field, and "Save this address" for a new one. */
export function AddressPicker({ choices, pickedId, onPick, remember, onRememberChange }: AddressPickerProps) {
  const theme = useTheme();
  return (
    <View style={{ gap: theme.spacing[2] }}>
      {choices.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: theme.spacing[2] }} keyboardShouldPersistTaps="handled">
          {choices.map((c) => <Chip key={c.id} label={c.label} selected={c.id === pickedId} onPress={() => onPick(c)} />)}
        </ScrollView>
      ) : null}
      {pickedId === null ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <AppText variant="caption" style={{ color: theme.colors.textSecondary }}>Save this address for next time</AppText>
          <Switch accessibilityLabel="Save this address for next time" value={remember} onValueChange={onRememberChange} trackColor={{ true: theme.colors.brand, false: theme.colors.separator }} />
        </View>
      ) : null}
    </View>
  );
}
