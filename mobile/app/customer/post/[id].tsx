import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArticleView } from '../../../src/components/feed/ArticleView';

// Prototype Article: opened from a feed card; "Book" goes to the linked service's Date & time, or the storefront.
export default function PostScreen() {
  const { id = '' } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  return (
    <ArticleView
      postId={id}
      nav={{
        openArtist: (artistId) => router.push({ pathname: '/customer/artist/[id]', params: { id: artistId } }),
        openPost: (postId) => router.push({ pathname: '/customer/post/[id]', params: { id: postId } }),
        book: (artistId, serviceId) => router.push({ pathname: '/customer/book/[artistId]', params: { artistId, serviceId } }),
      }}
    />
  );
}
