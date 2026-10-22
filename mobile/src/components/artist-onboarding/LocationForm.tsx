import { useState } from 'react';
import { View } from 'react-native';
import { FormScreen, FormHeading } from '../common/FormScreen';
import { AppText } from '../common/AppText';
import { AppButton } from '../common/AppButton';
import { AppTextField } from '../common/AppTextField';
import { useTheme } from '../../core/theme/theme-provider';
import { useArtistProfile, useSaveLocation } from '../../hooks/artist-onboarding/artist-onboarding';
import { useAreas, useNearestArea } from '../../hooks/catalog/catalog';
import { errorMessage } from '../../core/api/error-message';
import { currentPosition, locationErrorMessage, placeAt } from '../../core/location/location';
import type { Coordinates } from '../../core/location/location';
import type { Area } from '../../types/catalog/catalog';
import { AreaField } from './AreaField';
import { CurrentLocationCard } from './CurrentLocationCard';
import type { CurrentLocationState } from './CurrentLocationCard';
import { PinConfirmSheet } from './PinConfirmSheet';

const PINCODE = /^[1-9][0-9]{5}$/; // backend LocationIn.pincode

interface LocationFormProps {
  /** Onboarding shows its step bar; the approved artist's update screen passes nothing. */
  step?: { current: number; total: number };
  eyebrow: string;
  saveLabel: string;
  onBack?: () => void;
  /** After a successful save: the next onboarding step, or back where the artist came from. */
  onSaved: () => void;
}

/** AtelierScreen "onbLocation", Swiggy / Urban Company style: "Use my current location" opens a map to confirm the
 * pin, which picks the area it falls in and the phone's PIN code; or the artist picks the area from the city's list.
 * The area sets the city; clients only ever see the area and a distance, never the address or the pin. */
export function LocationForm({ step, eyebrow, saveLabel, onBack, onSaved }: LocationFormProps) {
  const theme = useTheme();
  const { data: saved } = useArtistProfile();
  const saveLocation = useSaveLocation();
  const savedPin = saved?.latitude != null && saved?.longitude != null ? { latitude: saved.latitude, longitude: saved.longitude } : null;

  const [pin, setPin] = useState<Coordinates | null>(savedPin);
  const [confirming, setConfirming] = useState<Coordinates | null>(null); // the map is open from here
  const [gps, setGps] = useState<CurrentLocationState>(savedPin ? 'set' : 'idle');
  const [chosen, setChosen] = useState<Area | null>(null); // picked from the list; beats the pin's area
  const [pincode, setPincode] = useState(saved?.pincode ?? '');
  const [addressLine, setAddressLine] = useState(saved?.address_line ?? '');
  const [error, setError] = useState<string | null>(null);

  const freshPin = pin !== savedPin ? pin : null; // only a newly confirmed pin looks up its area
  const nearest = useNearestArea(freshPin);
  const listCity = chosen?.city ?? nearest.data?.city ?? saved?.city ?? null;
  const areas = useAreas(listCity);
  const savedArea = areas.data?.find((a) => a.id === saved?.area_id) ?? null;
  const area = chosen ?? (freshPin ? nearest.data ?? null : savedArea);
  const pinOutsideAreas = !!freshPin && nearest.isSuccess && nearest.data === null && !chosen;

  const detect = async () => {
    setError(null);
    setGps('busy');
    try {
      setConfirming(await currentPosition());
    } catch (e) {
      setGps(pin ? 'set' : 'idle');
      setError(locationErrorMessage(e));
    }
  };
  const confirm = async (confirmed: Coordinates) => {
    setConfirming(null);
    setPin(confirmed);
    setChosen(null);
    setGps('set');
    const place = await placeAt(confirmed); // never throws: a failed lookup just leaves the PIN code to the artist
    const code = place.pincode?.replace(/\D/g, '') ?? '';
    if (PINCODE.test(code)) setPincode(code);
  };
  const cancelMap = () => { setConfirming(null); setGps(pin ? 'set' : 'idle'); };
  const forget = () => { setPin(null); setGps('idle'); };

  const pincodeValid = PINCODE.test(pincode);
  const ready = !!area && pincodeValid;
  const save = async () => {
    if (!area || !pincodeValid) return; // disabled buttons still reach onPress under RNTL
    setError(null);
    try {
      await saveLocation.mutateAsync({
        area_id: area.id,
        pincode,
        address_line: addressLine.trim() || null,
        latitude: pin?.latitude ?? null,
        longitude: pin?.longitude ?? null,
      });
      onSaved();
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  return (
    <FormScreen
      onBack={onBack}
      step={step?.current}
      steps={step?.total}
      footer={<AppButton label={saveLabel} onPress={() => { void save(); }} loading={saveLocation.isPending} disabled={!ready} />}
    >
      <FormHeading
        eyebrow={eyebrow}
        title="Where do you"
        accent="work from?"
        subtitle="We use your location to show you to clients nearby. Clients only see your area, never your address."
      />
      <View style={{ marginTop: theme.spacing.md }}>
        <CurrentLocationCard
          state={gps}
          title={area?.name ?? 'Pin placed'}
          detail={[area?.city ?? saved?.city, pincode].filter(Boolean).join(' ')}
          onDetect={() => { void detect(); }}
          onChange={forget}
        />
      </View>
      <AppText variant="caption" style={{ color: pinOutsideAreas ? theme.colors.error : theme.colors.textMuted, marginTop: theme.spacing.md }}>
        {pinOutsideAreas
          ? 'We couldn’t match your pin to an area we serve. Choose the nearest area below.'
          : gps === 'set' ? 'Check your area and pincode below' : 'or choose your area and enter your pincode below'}
      </AppText>

      <View style={{ gap: theme.spacing.md, marginTop: theme.spacing.md }}>
        <View>
          <AppText variant="label" style={{ color: theme.colors.textSecondary, marginBottom: theme.spacing.sm }}>
            {listCity ? `Area in ${listCity}` : 'Area'}
          </AppText>
          {areas.isError ? (
            <View style={{ alignItems: 'flex-start', gap: 8 }}>
              <AppText variant="caption" style={{ color: theme.colors.error }}>{errorMessage(areas.error)}</AppText>
              <AppButton label="Try again" variant="secondary" onPress={() => { void areas.refetch(); }} />
            </View>
          ) : (
            <AreaField city={listCity ?? ''} areas={areas.data ?? []} value={area} onChange={setChosen} />
          )}
        </View>
        <AppTextField
          label="Pincode"
          value={pincode}
          onChangeText={(text) => setPincode(text.replace(/\D/g, ''))}
          maxLength={6}
          keyboardType="number-pad"
          placeholder="e.g. 560095"
          error={pincode.length === 6 && !pincodeValid ? 'Enter a valid 6-digit pincode' : null}
        />
        <AppTextField label="Studio / house no. (optional)" value={addressLine} onChangeText={setAddressLine} maxLength={120} placeholder="e.g. 2nd floor, 14" />
      </View>

      {error ? <AppText variant="caption" style={{ color: theme.colors.error, marginTop: theme.spacing.md }}>{error}</AppText> : null}
      <PinConfirmSheet start={confirming} onConfirm={(c) => { void confirm(c); }} onClose={cancelMap} />
    </FormScreen>
  );
}
