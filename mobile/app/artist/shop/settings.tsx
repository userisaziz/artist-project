import { useRouter } from 'expo-router';
import { ShopSettingsForm } from '../../../src/components/shop/ShopSettingsForm';

export default function ShopSettings() {
  const router = useRouter();
  return <ShopSettingsForm onSaved={() => router.back()} />;
}
