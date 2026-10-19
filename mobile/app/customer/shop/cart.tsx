import { useRouter } from 'expo-router';
import { CartScreen } from '../../../src/components/shop/CartScreen';

export default function Cart() {
  const router = useRouter();
  return <CartScreen onCheckout={() => router.push('/customer/shop/checkout')} />;
}
