import { useRouter } from 'expo-router';
import { MyShop } from '../../../src/components/shop/MyShop';

// Me → My shop.
export default function ArtistShop() {
  const router = useRouter();
  return (
    <MyShop
      onAddProduct={() => router.push('/artist/shop/new-product')}
      onEditProduct={(id) => router.push({ pathname: '/artist/shop/[id]', params: { id } })}
      onOpenSettings={() => router.push('/artist/shop/settings')}
    />
  );
}
