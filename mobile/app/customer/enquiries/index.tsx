import { useRouter } from 'expo-router';
import { CustomerEnquiries } from '../../../src/components/quotes/CustomerEnquiries';

// Profile → My quotes.
export default function MyQuotes() {
  const router = useRouter();
  return <CustomerEnquiries onOpen={(id) => router.push({ pathname: '/customer/enquiries/[id]', params: { id } })} />;
}
