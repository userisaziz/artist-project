import { useRouter } from 'expo-router';
import { ArtistEnquiries } from '../../../src/components/quotes/ArtistEnquiries';

// Me → Enquiries.
export default function Enquiries() {
  const router = useRouter();
  return <ArtistEnquiries onOpen={(id) => router.push({ pathname: '/artist/enquiries/[id]', params: { id } })} />;
}
