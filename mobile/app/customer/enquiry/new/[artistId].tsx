import { useLocalSearchParams, useRouter } from 'expo-router';
import { EnquiryForm } from '../../../../src/components/quotes/EnquiryForm';
import { useArtistPublic } from '../../../../src/hooks/directory/directory';

// Storefront or a made-to-order service → Request a quote. The app layer composes directory (the artist's name and
// the service asked about) and quotes (the form).
export default function NewEnquiry() {
  const router = useRouter();
  const { artistId = '', serviceId } = useLocalSearchParams<{ artistId: string; serviceId?: string }>();
  const artist = useArtistPublic(artistId);
  const service = serviceId ? artist.data?.services.find((s) => s.id === serviceId) : undefined;
  return (
    <EnquiryForm
      artistId={artistId}
      artistName={artist.data?.business_name}
      service={service}
      onSent={(id) => router.replace({ pathname: '/customer/enquiries/[id]', params: { id } })}
    />
  );
}
