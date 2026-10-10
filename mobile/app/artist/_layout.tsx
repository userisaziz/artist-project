import { Stack } from 'expo-router';

// Artist area stack. Guarded at the root (role === 'artist'), so everything here is artist-only.
// Future screens (portfolio, submissions) are added as siblings — paths stay under /artist.
export default function ArtistLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
