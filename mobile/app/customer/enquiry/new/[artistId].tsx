import { useLocalSearchParams, useRouter } from 'expo-router';
import { EnquiryForm } from '../../../../src/components/quotes/EnquiryForm';
import { useArtistPublic } from '../../../../src/hooks/directory/directory';

// Storefront → Request a quote. The app layer composes directory (the artist's name) and quotes (the form).
export default function NewEnquiry() {
  const router = useRouter();
  const { artistId = '' } = useLocalSearchParams<{ artistId: string }>();
  const artist = useArtistPublic(artistId);
  return (
    <EnquiryForm
      artistId={artistId}
      artistName={artist.data?.business_name}
      onSent={(id) => router.replace({ pathname: '/customer/enquiries/[id]', params: { id } })}
    />
  );
}
