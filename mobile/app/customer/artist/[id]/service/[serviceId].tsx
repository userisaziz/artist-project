import { useLocalSearchParams, useRouter } from 'expo-router';
import { ServiceDetail } from '../../../../../src/components/directory/ServiceDetail';
import { encodeAddonPicks } from '../../../../../src/utils/bookings/addons';

// Design "Service detail": opened from a package on the storefront; "Check availability" opens Date & time, and a
// made-to-order service's "Request a quote" opens an enquiry about it.
export default function ServiceScreen() {
  const { id = '', serviceId = '' } = useLocalSearchParams<{ id: string; serviceId: string }>();
  const router = useRouter();
  return (
    <ServiceDetail
      artistId={id}
      serviceId={serviceId}
      onCheckAvailability={(service, addons, quantity) =>
        router.push({ pathname: '/customer/book/[artistId]', params: { artistId: id, serviceId: service.id, addons: encodeAddonPicks(addons), qty: String(quantity) } })}
      onRequestQuote={(service, addons, quantity) =>
        router.push({ pathname: '/customer/enquiry/new/[artistId]', params: { artistId: id, serviceId: service.id, qty: String(quantity), addons: encodeAddonPicks(addons) } })}
    />
  );
}
