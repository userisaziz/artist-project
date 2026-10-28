import type { CustomerPlace } from '../../types/directory/directory';

const formatKm = (km: number) => (Number.isInteger(km) ? String(km) : km.toFixed(1));

/** Where the listed artists are, for headers: "within 5 km of BTM Layout, Bangalore", "in Pune", "in all cities".
 *  `radiusKm` is what the server applied (it widens when few artists are close); null means no limit. */
export function placeLine(place: CustomerPlace | null, radiusKm: number | null | undefined): string {
  if (!place) return 'in all cities';
  if (!place.coords) return `in ${place.city ?? place.label}`;
  const of = place.source === 'gps' && place.areaId === null ? 'you' : place.label;
  return radiusKm ? `within ${formatKm(radiusKm)} km of ${of}` : `near ${of}`;
}
