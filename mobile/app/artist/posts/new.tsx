import { useRouter } from 'expo-router';
import { NewPostForm } from '../../../src/components/feed/NewPostForm';
import { useArtistProfile } from '../../../src/hooks/artist-onboarding/artist-onboarding';

// Prototype New post. Only approved services can be linked ("Book this look").
export default function NewPost() {
  const router = useRouter();
  const profile = useArtistProfile();
  const services = (profile.data?.services ?? []).filter((s) => s.status === 'approved').map((s) => ({ id: s.id, name: s.name }));
  return <NewPostForm services={services} onCancel={() => router.back()} onPosted={() => router.back()} />;
}
