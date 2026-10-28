import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import type { CustomerPlace } from '../../types/directory/directory';

// The customer's chosen place, kept between launches. Not a secret, but secure-store is the one store the app has;
// the web dev preview has no secure-store, so it uses localStorage.
const PLACE_KEY = 'ac.customer_place';
const SOURCES: CustomerPlace['source'][] = ['gps', 'search', 'city'];

const isNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** Our own earlier write, but storage can hold an older shape: anything unusable reads as no place. */
export function parsePlace(raw: string | null): CustomerPlace | null {
  if (!raw) return null;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null; // unreadable: Home asks for the location again
  }
  if (typeof value !== 'object' || value === null) return null;
  const p = value as Partial<CustomerPlace>;
  const coordsOk = p.coords === null || (typeof p.coords === 'object' && isNumber(p.coords?.latitude) && isNumber(p.coords?.longitude));
  const usable = typeof p.label === 'string' && !!p.source && SOURCES.includes(p.source) && coordsOk
    && (p.city === null || typeof p.city === 'string') && (p.areaId === null || isNumber(p.areaId));
  return usable ? (value as CustomerPlace) : null;
}

export const placeStore = {
  async load(): Promise<CustomerPlace | null> {
    if (Platform.OS === 'web') return parsePlace(localStorage.getItem(PLACE_KEY));
    return parsePlace(await SecureStore.getItemAsync(PLACE_KEY));
  },
  async save(place: CustomerPlace | null): Promise<void> {
    if (Platform.OS === 'web') {
      if (place) localStorage.setItem(PLACE_KEY, JSON.stringify(place));
      else localStorage.removeItem(PLACE_KEY);
      return;
    }
    if (place) await SecureStore.setItemAsync(PLACE_KEY, JSON.stringify(place));
    else await SecureStore.deleteItemAsync(PLACE_KEY);
  },
};
