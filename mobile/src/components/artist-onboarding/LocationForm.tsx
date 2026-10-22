import { useState } from 'react';
import { View } from 'react-native';
import { FormScreen, FormHeading } from '../common/FormScreen';
import { AppText } from '../common/AppText';
import { AppButton } from '../common/AppButton';
import { AppTextField } from '../common/AppTextField';
import { useTheme } from '../../core/theme/theme-provider';
import { useArtistProfile, useSaveLocation } from '../../hooks/artist-onboarding/artist-onboarding';
import { errorMessage } from '../../core/api/error-message';
import { currentPlace, locationErrorMessage } from '../../core/location/location';
import type { Coordinates } from '../../core/location/location';
import { CurrentLocationCard } from './CurrentLocationCard';
import type { CurrentLocationState } from './CurrentLocationCard';

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

/** AtelierScreen "onbLocation": "Use my current location" (GPS pin plus the phone's guess at the area and pincode),
 * or the area, pincode and an optional studio / house no. by hand. The city comes from the Profile step; clients
 * only ever see the area and a distance, never the address or the pin. */
export function LocationForm({ step, eyebrow, saveLabel, onBack, onSaved }: LocationFormProps) {
  const theme = useTheme();
  const { data: saved } = useArtistProfile();
  const saveLocation = useSaveLocation();

  const [locality, setLocality] = useState(saved?.locality ?? '');
  const [pincode, setPincode] = useState(saved?.pincode ?? '');
  const [addressLine, setAddressLine] = useState(saved?.address_line ?? '');
  const [error, setError] = useState<string | null>(null);
  const savedPin = saved?.latitude != null && saved?.longitude != null ? { latitude: saved.latitude, longitude: saved.longitude } : null;
  const [coords, setCoords] = useState<Coordinates | null>(savedPin);
  const [gps, setGps] = useState<CurrentLocationState>(savedPin ? 'set' : 'idle');
  const [found, setFound] = useState({ title: saved?.locality ?? '', detail: [saved?.city, saved?.pincode].filter(Boolean).join(' ') });

  const detect = async () => {
    setError(null);
    setGps('busy');
    try {
      const place = await currentPlace();
      const pin = place.pincode?.replace(/\D/g, '') ?? '';
      setCoords(place.coords);
      if (place.locality) setLocality(place.locality);
      if (PINCODE.test(pin)) setPincode(pin);
      setFound({ title: place.locality ?? 'Location found', detail: [place.city ?? saved?.city, pin].filter(Boolean).join(' ') });
      setGps('set');
    } catch (e) {
      setGps('idle');
      setError(locationErrorMessage(e));
    }
  };
  const forget = () => { setCoords(null); setGps('idle'); };

  const pincodeValid = PINCODE.test(pincode);
  const ready = !!locality.trim() && pincodeValid;
  const save = async () => {
    if (!ready) return; // disabled buttons still reach onPress under RNTL
    setError(null);
    try {
      await saveLocation.mutateAsync({
        locality: locality.trim(),
        pincode,
        address_line: addressLine.trim() || null,
        latitude: coords?.latitude ?? null,
        longitude: coords?.longitude ?? null,
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
        <CurrentLocationCard state={gps} title={found.title} detail={found.detail} onDetect={() => { void detect(); }} onChange={forget} />
      </View>
      <AppText variant="caption" style={{ color: theme.colors.textMuted, marginTop: theme.spacing.md }}>
        {gps === 'set' ? 'Check your area and pincode below' : 'or enter your studio address manually below'}
      </AppText>
      {saved?.city ? (
        <AppText variant="caption" style={{ color: theme.colors.textMuted, marginTop: theme.spacing.md }}>{`City: ${saved.city}`}</AppText>
      ) : null}
      <View style={{ gap: theme.spacing.md, marginTop: theme.spacing.md }}>
        <AppTextField label="Area" value={locality} onChangeText={setLocality} maxLength={80} autoCapitalize="words" placeholder="e.g. Koramangala 5th Block" />
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
    </FormScreen>
  );
}
