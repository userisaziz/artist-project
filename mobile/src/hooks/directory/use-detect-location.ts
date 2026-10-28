import { useCallback, useEffect, useRef, useState } from 'react';
import * as placesApi from '../../api/directory/places';
import { currentPosition, LocationError, locationErrorMessage, type Coordinates } from '../../core/location/location';
import { useCustomerPlace } from '../../context/directory/city-context';
import type { CustomerPlace, NearbyArea } from '../../types/directory/directory';

const SEARCH_INSTEAD = 'search your area';

/** The phone's position as a place: named after the nearest of our areas when it's inside one. */
export function gpsPlace(coords: Coordinates, area: NearbyArea | null): CustomerPlace {
  return {
    label: area ? `${area.name}, ${area.city}` : 'Near you',
    city: area?.city ?? null,
    areaId: area?.id ?? null,
    coords,
    source: 'gps',
  };
}

/** Finds the customer from the phone. With `auto`, it runs once when the screen opens (showing the permission popup)
 *  unless they've picked a place by search; a GPS place is refreshed, since they may have moved. */
export function useDetectLocation({ auto }: { auto: boolean }) {
  const { place, setPlace, loaded } = useCustomerPlace();
  const [locating, setLocating] = useState(false);
  const [failure, setFailure] = useState<unknown>(null);
  const tried = useRef(false);

  const locate = useCallback(async (): Promise<boolean> => {
    setFailure(null);
    setLocating(true);
    try {
      const coords = await currentPosition();
      // Naming the place is a nicety: without an area the point still searches.
      const area = await placesApi.nearestArea(coords.latitude, coords.longitude).catch(() => null);
      setPlace(gpsPlace(coords, area));
      return true;
    } catch (e) {
      setFailure(e);
      return false;
    } finally {
      setLocating(false);
    }
  }, [setPlace]);

  const keepsChoice = place !== null && place.source !== 'gps';
  useEffect(() => {
    if (!auto || !loaded || tried.current || keepsChoice) return;
    tried.current = true;
    void locate();
  }, [auto, loaded, keepsChoice, locate]);

  return {
    locating,
    locate,
    /** Why the phone couldn't say, for the "search your area" fallback; null when it hasn't failed. */
    error: failure ? locationErrorMessage(failure, SEARCH_INSTEAD) : null,
    /** Refused for good: only Settings can turn it back on. */
    blocked: failure instanceof LocationError && failure.reason === 'blocked',
  };
}
