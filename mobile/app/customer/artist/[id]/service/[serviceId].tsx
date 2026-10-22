import { useLocalSearchParams, useRouter } from 'expo-router';
import { ServiceDetail } from '../../../../../src/components/directory/ServiceDetail';
import { encodeAddonPicks } from '../../../../../src/utils/bookings/addons';

// Design "Service detail": opened from a package on the storefront; "Check availability" opens Date & time.
export default function ServiceScreen() {
  const { id = '', serviceId = '' } = useLocalSearchParams<{ id: string; serviceId: string }>();
  const router = useRouter();
  return (
    <ServiceDetail
      artistId={id}
      serviceId={serviceId}
      onCheckAvailability={(service, addons) =>
        router.push({ pathname: '/customer/book/[artistId]', params: { artistId: id, serviceId: service.id, addons: encodeAddonPicks(addons) } })}
    />
  );
}
