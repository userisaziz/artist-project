import { useLocalSearchParams } from 'expo-router';
import { OrderDetail } from '../../../../src/components/shop/OrderDetail';

export default function OrderScreen() {
  const { id = '' } = useLocalSearchParams<{ id: string }>();
  return <OrderDetail orderId={id} />;
}
