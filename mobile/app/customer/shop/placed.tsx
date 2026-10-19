import { useLocalSearchParams, useRouter } from 'expo-router';
import { OrderPlaced } from '../../../src/components/shop/OrderPlaced';

export default function Placed() {
  const { codes = '' } = useLocalSearchParams<{ codes: string }>();
  const router = useRouter();
  return (
    <OrderPlaced
      codes={codes.split(',').filter(Boolean)}
      onTrack={() => router.replace('/customer/shop/orders')}
      onKeepShopping={() => router.replace('/customer/shop')}
    />
  );
}
