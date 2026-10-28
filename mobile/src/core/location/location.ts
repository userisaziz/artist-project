import { Linking } from 'react-native';
import type * as LocationModule from 'expo-location';

// Device location behind one module so features never import expo-location directly. Foreground only: asked for on
// the customer's Home and when the user taps "Use my current location" or "Near me".

export interface Coordinates {
  latitude: number;
  longitude: number;
}

/** What the phone can tell about where it is: the pin plus a best-guess area and PIN code. */
export interface PlaceGuess {
  coords: Coordinates;
  locality: string | null;
  pincode: string | null;
  city: string | null;
}

/** denied: not allowed (yet). blocked: refused for good, only Settings can change it. off: location is switched off
 *  on the phone. unavailable: no fix, or this build has no location module. */
export type LocationFailure = 'denied' | 'blocked' | 'off' | 'unavailable';

/** A location request that can't be answered; `reason` picks the message the screen shows. */
export class LocationError extends Error {
  constructor(public readonly reason: LocationFailure) {
    super(reason === 'denied' || reason === 'blocked' ? 'Location permission is off' : 'Location is unavailable');
  }
}

/** How long to wait for a fresh fix before settling for the phone's last known position (indoors can take long). */
export const POSITION_TIMEOUT_MS = 10_000;
const LAST_KNOWN_MAX_AGE_MS = 10 * 60_000;

function loadLocation(): typeof LocationModule | null {
  try {
    return require('expo-location') as typeof LocationModule;
  } catch (error) {
    if (__DEV__) console.warn('Location is off in this build (rebuild the dev client):', error);
    return null;
  }
}
const Location = loadLocation();

/** A fresh fix, or null when none comes within POSITION_TIMEOUT_MS or the OS refuses. */
async function freshFix(module: typeof LocationModule): Promise<Coordinates | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<null>((resolve) => { timer = setTimeout(() => resolve(null), POSITION_TIMEOUT_MS); });
  const fix = module.getCurrentPositionAsync({ accuracy: module.Accuracy.Balanced })
    .then(({ coords }) => ({ latitude: coords.latitude, longitude: coords.longitude }))
    .catch(() => null); // no fix or refused: the caller tries the last known position next
  try {
    return await Promise.race([fix, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

/** Reads the current position. With `ask` (the default) it shows the permission popup when needed; without, it only
 *  reads when already allowed, so a screen can check silently on open. Falls back to the last known position. */
export async function currentPosition({ ask = true }: { ask?: boolean } = {}): Promise<Coordinates> {
  if (!Location) throw new LocationError('unavailable');
  const permission = ask ? await Location.requestForegroundPermissionsAsync() : await Location.getForegroundPermissionsAsync();
  if (!permission.granted) throw new LocationError(permission.canAskAgain === false ? 'blocked' : 'denied');
  if (!(await Location.hasServicesEnabledAsync())) throw new LocationError('off');
  const fresh = await freshFix(Location);
  if (fresh) return fresh;
  const last = await Location.getLastKnownPositionAsync({ maxAge: LAST_KNOWN_MAX_AGE_MS }).catch(() => null);
  if (last) return { latitude: last.coords.latitude, longitude: last.coords.longitude };
  throw new LocationError('unavailable');
}

/** Opens this app's page in the phone's Settings, the only way back after a permanent refusal. */
export function openLocationSettings(): Promise<void> {
  return Linking.openSettings();
}

/** What the phone's reverse geocoder says about a point: area, PIN code and city (any of which may be missing). */
export async function placeAt(coords: Coordinates): Promise<PlaceGuess> {
  if (!Location) return { coords, locality: null, pincode: null, city: null };
  try {
    const [place] = await Location.reverseGeocodeAsync(coords);
    return {
      coords,
      locality: place?.district ?? place?.subregion ?? place?.name ?? null,
      pincode: place?.postalCode ?? null,
      city: place?.city ?? null,
    };
  } catch {
    return { coords, locality: null, pincode: null, city: null }; // the pin still counts; the artist types the rest
  }
}

/** Current position plus the phone's reverse-geocoded area, PIN code and city. */
export async function currentPlace(): Promise<PlaceGuess> {
  return placeAt(await currentPosition());
}

/** The message a screen shows for a failed location request; `instead` is what the user can do without it. */
export function locationErrorMessage(error: unknown, instead = 'enter your area and pincode below'): string {
  const why = error instanceof LocationError ? error.reason : 'unavailable';
  if (why === 'denied') return `Allow location access in Settings, or ${instead}.`;
  if (why === 'blocked') return `Location access is off for this app. Turn it on in Settings, or ${instead}.`;
  if (why === 'off') return `Location is switched off on your phone. Turn it on, or ${instead}.`;
  return `We couldn’t find your location. Check that location is on, or ${instead}.`;
}
