import { PlaceholderHome } from '../../src/components/PlaceholderHome';

// Artist home. This route only mounts for an artist (the root gate guards the folder),
// so the role is fixed here — no runtime branching. Grows into portfolio/submissions later.
export default function ArtistHome() {
  return <PlaceholderHome role="Artist" />;
}
