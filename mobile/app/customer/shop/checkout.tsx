import { useRouter } from 'expo-router';
import { CheckoutScreen } from '../../../src/components/shop/CheckoutScreen';
import { useAddressBook } from '../../../src/hooks/addresses/addresses';

export default function Checkout() {
  const router = useRouter();
  const addressBook = useAddressBook();
  return (
    <CheckoutScreen
      addressBook={addressBook}
      onPlaced={(orders) => router.replace({ pathname: '/customer/shop/placed', params: { codes: orders.map((o) => o.code).join(',') } })}
    />
  );
}
