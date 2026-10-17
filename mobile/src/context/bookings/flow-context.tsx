import { createContext, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

/** Booking-flow state that outlives a screen: Review & pay leaves a notice for Date & time after a slot conflict. */
interface BookingFlow {
  notice: string | null;
  setNotice: (notice: string | null) => void;
}

const BookingFlowContext = createContext<BookingFlow>({ notice: null, setNotice: () => {} });

export function BookingFlowProvider({ children }: { children: ReactNode }) {
  const [notice, setNotice] = useState<string | null>(null);
  const value = useMemo(() => ({ notice, setNotice }), [notice]);
  return <BookingFlowContext.Provider value={value}>{children}</BookingFlowContext.Provider>;
}

export function useBookingFlow(): BookingFlow {
  return useContext(BookingFlowContext);
}
