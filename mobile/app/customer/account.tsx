import { useRouter } from 'expo-router';
import { EditAccountForm } from '../../src/components/auth/EditAccountForm';

// Profile → Edit profile.
export default function CustomerAccount() {
  const router = useRouter();
  return <EditAccountForm onDone={() => router.back()} />;
}
