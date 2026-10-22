import { useLocalSearchParams, useRouter } from 'expo-router';
import { Storefront } from '../../../src/components/directory/Storefront';
import { ArtistPostCards } from '../../../src/components/feed/ArtistPostCards';
import { ErrorView } from '../../../src/components/common/StateViews';
import { useChatOpener } from '../../../src/hooks/chat/chat';
import { useArtistPosts, useFollowState, useToggleFollow } from '../../../src/hooks/feed/feed';
import { useSaveToggle } from '../../../src/hooks/saved/saved';

const STOREFRONT_POSTS = 2;

// Spec §2 Artist storefront: Book now / Check availability go to Date & time (asking which package when there are
// several), a package opens Service detail, a post opens it, Message the chat, Enquire a custom quote. Following and
// "From the studio" come from the feed feature, composed in here.
export default function ArtistStorefrontScreen() {
  const { id = '' } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const chat = useChatOpener('customer');
  const save = useSaveToggle('artist');
  const posts = useArtistPosts(id, STOREFRONT_POSTS, true);
  const following = useFollowState(id, true);
  const toggleFollow = useToggleFollow();
  const openPost = (postId: string) => router.push({ pathname: '/customer/post/[id]', params: { id: postId } });
  const postsSlot = posts.isError
    ? <ErrorView error={posts.error} onRetry={() => { void posts.refetch(); }} />
    : posts.data?.length ? <ArtistPostCards posts={posts.data} onOpen={openPost} /> : undefined;
  return (
    <Storefront
      artistId={id}
      customer={{
        onBook: (service) => router.push({ pathname: '/customer/book/[artistId]', params: { artistId: id, serviceId: service.id } }),
        onOpenService: (service) => router.push({ pathname: '/customer/artist/[id]/service/[serviceId]', params: { id, serviceId: service.id } }),
        onSeeAllReviews: () => router.push({ pathname: '/customer/artist/[id]/reviews', params: { id } }),
        onMessage: () => { void chat.open(id); },
        messaging: chat.openingId === id,
        onRequestQuote: () => router.push({ pathname: '/customer/enquiry/new/[artistId]', params: { artistId: id } }),
        save,
        follow: following.data === undefined ? undefined : {
          following: following.data,
          pending: toggleFollow.isPending,
          onToggle: () => toggleFollow.mutate({ artistId: id, following: !following.data }),
        },
        posts: postsSlot,
      }}
    />
  );
}
