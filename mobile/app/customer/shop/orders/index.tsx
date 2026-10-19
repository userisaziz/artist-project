import { useRouter } from 'expo-router';
import { MyOrders } from '../../../../src/components/shop/MyOrders';

// Profile → My orders.
export default function Orders() {
  const router = useRouter();
  return <MyOrders onOpen={(id) => router.push({ pathname: '/customer/shop/orders/[id]', params: { id } })} />;
}
