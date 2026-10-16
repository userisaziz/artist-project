import { useArtistProfile } from '../../src/artist/queries';
import { Storefront } from '../../src/directory/Storefront';

// "View public profile" from Me: the artist's own storefront as customers see it, without booking.
export default function PublicProfile() {
  const { data } = useArtistProfile();
  return <Storefront artistId={data?.id ?? ''} />;
}
