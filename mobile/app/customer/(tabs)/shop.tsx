import { useRouter } from 'expo-router';
import { ShopHome } from '../../../src/components/shop/ShopHome';

// Design "Shop": products made by artists.
export default function ShopTab() {
  const router = useRouter();
  return (
    <ShopHome
      onOpenProduct={(id) => router.push({ pathname: '/customer/shop/product/[id]', params: { id } })}
      onOpenCart={() => router.push('/customer/shop/cart')}
    />
  );
}
