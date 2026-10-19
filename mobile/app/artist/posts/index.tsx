import { useRouter } from 'expo-router';
import { MyPosts } from '../../../src/components/feed/MyPosts';

// Me → Posts & articles.
export default function ArtistPosts() {
  const router = useRouter();
  return <MyPosts onNewPost={() => router.push('/artist/posts/new')} />;
}
