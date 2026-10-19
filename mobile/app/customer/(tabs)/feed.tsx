import { useRouter } from 'expo-router';
import { FeedList } from '../../../src/components/feed/FeedList';

// Prototype Feed: artists' looks and guides; cards open the storefront, the article, or Date & time.
export default function CustomerFeed() {
  const router = useRouter();
  return (
    <FeedList
      nav={{
        openArtist: (id) => router.push({ pathname: '/customer/artist/[id]', params: { id } }),
        openPost: (id) => router.push({ pathname: '/customer/post/[id]', params: { id } }),
        book: (artistId, serviceId) => router.push({ pathname: '/customer/book/[artistId]', params: { artistId, serviceId } }),
      }}
    />
  );
}
