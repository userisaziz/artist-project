import { Redirect } from 'expo-router';
import { useArtistProfile } from '../../src/artist/queries';
import { useArtistFlow } from '../../src/artist/flow-context';
import { artistHref } from '../../src/artist/routing';

// `/artist` hub: forwards to the one area the artist layout is showing (same rule as its guards).
export default function ArtistIndex() {
  const { data } = useArtistProfile();
  const { editing } = useArtistFlow();
  if (data === undefined) return null; // the layout only mounts the stack once the profile has loaded
  return <Redirect href={artistHref(data, editing)} />;
}
