import { useRouter } from 'expo-router';
import { ProductForm } from '../../../src/components/shop/ProductForm';

export default function NewProduct() {
  const router = useRouter();
  return <ProductForm onCancel={() => router.back()} onSaved={() => router.back()} />;
}
