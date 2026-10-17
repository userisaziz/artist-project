import { useArtistProfile } from '../../src/hooks/artist-onboarding/artist-onboarding';
import { Storefront } from '../../src/components/directory/Storefront';

// "View public profile" from Me: the artist's own storefront as customers see it, without booking.
export default function PublicProfile() {
  const { data } = useArtistProfile();
  return <Storefront artistId={data?.id ?? ''} />;
}
