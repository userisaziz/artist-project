import { Redirect } from 'expo-router';
import { useArtistProfile } from '../../src/hooks/artist-onboarding/artist-onboarding';
import { useArtistFlow } from '../../src/context/artist-onboarding/flow-context';
import { artistHref } from '../../src/utils/artist-onboarding/routing';

// `/artist` hub: forwards to the one area the artist layout is showing (same rule as its guards).
export default function ArtistIndex() {
  const { data } = useArtistProfile();
  const { editing } = useArtistFlow();
  if (data === undefined) return null; // the layout only mounts the stack once the profile has loaded
  return <Redirect href={artistHref(data, editing)} />;
}
