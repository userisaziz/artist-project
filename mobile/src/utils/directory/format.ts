import type { ArtistCard } from '../../types/directory/directory';
import { addDays, formatDay } from '../common/time';

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
