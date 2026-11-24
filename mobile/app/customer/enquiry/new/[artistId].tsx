import { useLocalSearchParams, useRouter } from 'expo-router';
import { EnquiryForm } from '../../../../src/components/quotes/EnquiryForm';
import { useArtistPublic } from '../../../../src/hooks/directory/directory';
import { LoadingView } from '../../../../src/components/common/StateViews';
import { suggestServices } from '../../../../src/utils/directory/storefront';
import { decodeAddonPicks } from '../../../../src/utils/bookings/addons';

// Storefront or a made-to-order service → Request a quote. The app layer composes directory (the artist's name and
// the service asked about) and quotes (the form).
export default function NewEnquiry() {
  const router = useRouter();
  const { artistId = '', serviceId, qty, addons } = useLocalSearchParams<{ artistId: string; serviceId?: string; qty?: string; addons?: string }>();
  const artist = useArtistPublic(artistId);
  const service = serviceId ? artist.data?.services.find((s) => s.id === serviceId) : undefined;
  if (serviceId && !service && artist.isPending) return <LoadingView label="Loading the service" />;
  return (
    <EnquiryForm
      artistId={artistId}
      artistName={artist.data?.business_name}
      service={service}
      suggestions={service ? suggestServices(artist.data?.services ?? [], service) : []}
      initial={service ? { quantity: Number(qty) || undefined, addons: decodeAddonPicks(addons, service.addons) } : undefined}
      key={service?.id ?? 'general'}
      onSent={(id) => router.replace({ pathname: '/customer/enquiries/[id]', params: { id } })}
    />
  );
}
