import type * as LocationModule from 'expo-location';

// Device location behind one module so features never import expo-location directly. Foreground only, and only
// when the user taps "Use my current location" or "Near me".

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

export type LocationFailure = 'denied' | 'unavailable';

/** A location request that can't be answered; `reason` picks the message the screen shows. */
export class LocationError extends Error {
  constructor(public readonly reason: LocationFailure) {
    super(reason === 'denied' ? 'Location permission is off' : 'Location is unavailable');
  }
}

function loadLocation(): typeof LocationModule | null {
  try {
    return require('expo-location') as typeof LocationModule;
  } catch (error) {
    if (__DEV__) console.warn('Location is off in this build (rebuild the dev client):', error);
    return null;
  }
}
const Location = loadLocation();

/** Asks for foreground permission if needed, then reads the current position. */
export async function currentPosition(): Promise<Coordinates> {
  if (!Location) throw new LocationError('unavailable');
  const { granted } = await Location.requestForegroundPermissionsAsync();
  if (!granted) throw new LocationError('denied');
  try {
    const { coords } = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    return { latitude: coords.latitude, longitude: coords.longitude };
  } catch {
    throw new LocationError('unavailable'); // GPS off, no fix, or the OS refused
  }
}

/** Current position plus the phone's reverse-geocoded area, PIN code and city (any of which may be missing). */
export async function currentPlace(): Promise<PlaceGuess> {
  const coords = await currentPosition();
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

/** The message a screen shows for a failed location request. */
export function locationErrorMessage(error: unknown): string {
  if (error instanceof LocationError && error.reason === 'denied') {
    return 'Allow location access in Settings, or enter your area and pincode below.';
  }
  return 'We couldn’t find your location. Check that location is on, or enter it below.';
}
