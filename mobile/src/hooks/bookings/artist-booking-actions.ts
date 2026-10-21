import { useCallback, useState } from 'react';
import * as bookingsApi from '../../api/bookings/bookings';
import { errorMessage } from '../../core/api/error-message';
import { useBookingWrite } from './bookings';

type Action =
  | { kind: 'accept' }
  | { kind: 'decline'; reason: string | null }
  | { kind: 'complete' }
  | { kind: 'accept-move' }
  | { kind: 'decline-move'; reason: string | null };

/** Accept, decline or complete one booking, or answer a request to move it; tracks which booking is busy and the last error, per booking. */
export function useArtistBookingActions() {
  const write = useBookingWrite();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const run = useCallback(async (id: string, action: Action): Promise<boolean> => {
    setBusyId(id);
    setErrors(({ [id]: _drop, ...rest }) => rest);
    try {
      await write(() => {
        if (action.kind === 'accept') return bookingsApi.acceptBooking(id);
        if (action.kind === 'decline') return bookingsApi.declineBooking(id, action.reason);
        if (action.kind === 'accept-move') return bookingsApi.acceptReschedule(id);
        if (action.kind === 'decline-move') return bookingsApi.declineReschedule(id, action.reason);
        return bookingsApi.completeBooking(id);
      });
      return true;
    } catch (e) {
      setErrors((prev) => ({ ...prev, [id]: errorMessage(e) }));
      return false;
    } finally {
      setBusyId(null);
    }
  }, [write]);

  return { run, busyId, errors };
}
