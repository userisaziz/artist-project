import { useRouter } from 'expo-router';
import { CheckoutScreen } from '../../../src/components/shop/CheckoutScreen';

export default function Checkout() {
  const router = useRouter();
  return (
    <CheckoutScreen
      onPlaced={(orders) => router.replace({ pathname: '/customer/shop/placed', params: { codes: orders.map((o) => o.code).join(',') } })}
    />
  );
}
