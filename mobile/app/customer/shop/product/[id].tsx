import { useLocalSearchParams, useRouter } from 'expo-router';
import { ProductDetail } from '../../../../src/components/shop/ProductDetail';

export default function ProductScreen() {
  const { id = '' } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  return <ProductDetail productId={id} onOpenCart={() => router.push('/customer/shop/cart')} onCheckout={() => router.push('/customer/shop/checkout')} />;
}
