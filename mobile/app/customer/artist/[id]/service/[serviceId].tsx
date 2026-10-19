import { useLocalSearchParams, useRouter } from 'expo-router';
import { ServiceDetail } from '../../../../../src/components/directory/ServiceDetail';

// Design "Service detail": opened from a package on the storefront; "Check availability" opens Date & time.
export default function ServiceScreen() {
  const { id = '', serviceId = '' } = useLocalSearchParams<{ id: string; serviceId: string }>();
  const router = useRouter();
  return (
    <ServiceDetail
      artistId={id}
      serviceId={serviceId}
      onCheckAvailability={(service) => router.push({ pathname: '/customer/book/[artistId]', params: { artistId: id, serviceId: service.id } })}
    />
  );
}
