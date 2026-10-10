import { PlaceholderHome } from '../src/components/PlaceholderHome';
import { useAuth } from '../src/auth/auth-provider';

export default function Home() {
  const { user } = useAuth();
  return <PlaceholderHome role={user?.role === 'artist' ? 'Artist' : 'Customer'} />;
}
