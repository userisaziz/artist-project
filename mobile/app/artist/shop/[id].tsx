import { useLocalSearchParams, useRouter } from 'expo-router';
import { EditProductForm } from '../../../src/components/shop/EditProductForm';

// My shop → a product.
export default function EditProduct() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  return <EditProductForm productId={id} onDone={() => router.back()} />;
}
