import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { placeStore } from '../../utils/directory/place-store';
import type { CustomerPlace } from '../../types/directory/directory';

interface PlaceChoice {
  /** Where to look for artists; null until set ("everywhere"). */
  place: CustomerPlace | null;
  setPlace: (place: CustomerPlace | null) => void;
  /** False until the place saved at the last launch has been read, so Home doesn't ask the phone over it. */
  loaded: boolean;
}

const PlaceContext = createContext<PlaceChoice | null>(null);

/** The customer's place, shared by Home and Explore and kept between launches. */
export function CityProvider({ children }: { children: ReactNode }) {
  const [place, setPlaceState] = useState<CustomerPlace | null>(null);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    let live = true;
    placeStore.load()
      .catch(() => null) // unreadable storage: start without a place, as on a first launch
      .then((saved) => {
        if (!live) return;
        setPlaceState((current) => current ?? saved); // a choice made while loading wins over the saved one
        setLoaded(true);
      });
    return () => { live = false; };
  }, []);
  const setPlace = useCallback((next: CustomerPlace | null) => {
    setPlaceState(next);
    // Remembering is a convenience: if it fails, the next launch simply asks again.
    placeStore.save(next).catch(() => undefined);
  }, []);
  const value = useMemo(() => ({ place, setPlace, loaded }), [place, setPlace, loaded]);
  return <PlaceContext.Provider value={value}>{children}</PlaceContext.Provider>;
}

export function useCustomerPlace(): PlaceChoice {
  const choice = useContext(PlaceContext);
  if (!choice) throw new Error('useCustomerPlace needs a CityProvider (app/customer/_layout.tsx)');
  return choice;
}

/** A whole city, as a `?city=` link picks it: no search point. */
export const cityPlace = (city: string): CustomerPlace => ({ label: city, city, areaId: null, coords: null, source: 'city' });

/** The city view of the place, for screens and links that only know cities. */
export function useCity(): { city: string | null; setCity: (city: string | null) => void } {
  const { place, setPlace } = useCustomerPlace();
  const setCity = useCallback((city: string | null) => setPlace(city ? cityPlace(city) : null), [setPlace]);
  return { city: place?.city ?? null, setCity };
}
