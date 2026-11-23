import type { ArtistCard } from '../../types/directory/directory';
import { addDays, formatDay } from '../common/time';
import { formatPrice } from '../common/format';

/** "Mehendi · Koramangala · 2.1 km": categories, the area (or the city before an artist set one), the distance. */
export function artistPlaceLine(artist: Pick<ArtistCard, 'categories' | 'locality' | 'city' | 'distance_km'>): string {
  const distance = artist.distance_km == null ? null : `${artist.distance_km} km`;
  return [artist.categories.map((c) => c.name).join(', '), artist.locality ?? artist.city, distance].filter(Boolean).join(' · ');
}

/** "Available today", "Available tomorrow" or "Free on Fri, 24 Oct" for a free-date match; null otherwise. */
export function availabilityLabel(freeOn: string | null, todayKey: string): string | null {
  if (!freeOn) return null;
  if (freeOn === todayKey) return 'Available today';
  if (freeOn === addDays(todayKey, 1)) return 'Available tomorrow';
  return `Free on ${formatDay(freeOn)}`;
}

/** What a screen reader says for an Explore result: name, rating, place line, starting price, availability. */
export function artistCardLabel(
  artist: Pick<ArtistCard, 'business_name' | 'categories' | 'locality' | 'city' | 'distance_km' | 'from_price_paise'>,
  rating: string,
  availability: string | null,
): string {
  const price = artist.from_price_paise === null ? null : `from ${formatPrice(artist.from_price_paise)}`;
  return [artist.business_name, rating, artistPlaceLine(artist), price, availability].filter(Boolean).join(', ');
}
