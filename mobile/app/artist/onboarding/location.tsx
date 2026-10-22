import { useRouter } from 'expo-router';
import { LocationForm } from '../../../src/components/artist-onboarding/LocationForm';

// Onboarding step 2 of 5: where the artist works; Continue saves and opens Services.
export default function LocationStep() {
  const router = useRouter();
  return (
    <LocationForm
      step={{ current: 2, total: 5 }}
      eyebrow="STEP 2 · LOCATION"
      saveLabel="Continue"
      onBack={() => router.dismissTo('/artist/onboarding/profile')}
      onSaved={() => router.push('/artist/onboarding/services')}
    />
  );
}
