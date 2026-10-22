import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

interface CityChoice {
  /** The city whose artists to show; null until the customer picks one ("all cities"). */
  city: string | null;
  setCity: (city: string | null) => void;
}

const CityContext = createContext<CityChoice | null>(null);

/** The customer's chosen city: client state for this app session, shared by Home and Explore. */
export function CityProvider({ children }: { children: ReactNode }) {
  const [city, setCity] = useState<string | null>(null);
  const value = useMemo(() => ({ city, setCity }), [city]);
  return <CityContext.Provider value={value}>{children}</CityContext.Provider>;
}

export function useCity(): CityChoice {
  const choice = useContext(CityContext);
  if (!choice) throw new Error('useCity needs a CityProvider (app/customer/_layout.tsx)');
  return choice;
}
