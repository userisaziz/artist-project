import { useLocalSearchParams, useRouter } from 'expo-router';
import { ProductDetail } from '../../../../src/components/shop/ProductDetail';
import { useSaveToggle } from '../../../../src/hooks/saved/saved';

export default function ProductScreen() {
  const { id = '' } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const save = useSaveToggle('product');
  return <ProductDetail productId={id} onOpenCart={() => router.push('/customer/shop/cart')} onCheckout={() => router.push('/customer/shop/checkout')} save={save} />;
}
