import { useRouter } from 'expo-router';
import { LocationForm } from '../../src/components/artist-onboarding/LocationForm';

// An approved artist adds or changes where they work (a profile requirement links here). No new review needed.
export default function UpdateLocation() {
  const router = useRouter();
  return <LocationForm eyebrow="YOUR LOCATION" saveLabel="Save location" onBack={() => router.back()} onSaved={() => router.back()} />;
}
