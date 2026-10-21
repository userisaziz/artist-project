import { useRouter } from 'expo-router';
import { SavedScreen } from '../../src/components/saved/SavedScreen';
import { PhotoPostCard } from '../../src/components/feed/PhotoPostCard';
import { ArticleCard } from '../../src/components/feed/ArticleCard';
import { ArtistCardView } from '../../src/components/directory/ArtistCardView';
import { ProductCard } from '../../src/components/shop/ProductCard';
import { useSaveToggle } from '../../src/hooks/saved/saved';
import { useCart } from '../../src/context/shop/cart-context';
import { useNow } from '../../src/hooks/common/use-now';
import type { FeedNavigation } from '../../src/components/feed/navigation';

// Profile → Saved. The app layer composes the features: each saved item is drawn with its own feature's card.
export default function Saved() {
  const router = useRouter();
  const now = useNow();
  const cart = useCart();
  const savePost = useSaveToggle('post');
  const nav: FeedNavigation = {
    openArtist: (id) => router.push({ pathname: '/customer/artist/[id]', params: { id } }),
    openPost: (id) => router.push({ pathname: '/customer/post/[id]', params: { id } }),
    book: (artistId, serviceId) => router.push({ pathname: '/customer/book/[artistId]', params: { artistId, serviceId } }),
    savePost,
  };
  return (
    <SavedScreen
      render={{
        post: (post) => (post.kind === 'article'
          ? <ArticleCard post={post} now={now} onOpen={() => nav.openPost(post.id)} save={savePost} />
          : <PhotoPostCard post={post} now={now} nav={nav} />),
        artist: (artist) => <ArtistCardView artist={artist} onPress={() => nav.openArtist(artist.id)} />,
        product: (product) => (
          <ProductCard product={product} onOpen={() => router.push({ pathname: '/customer/shop/product/[id]', params: { id: product.id } })} onAdd={() => cart.add(product)} />
        ),
      }}
    />
  );
}
