import { useCallback, useState } from 'react';
import * as bookingsApi from '../../api/endpoints/bookings';
import { errorMessage } from '../../core/api/error-message';
import { useBookingWrite } from '../../bookings/queries';

type Action = { kind: 'accept' } | { kind: 'decline'; reason: string | null } | { kind: 'complete' };

/** Accept, decline or complete one booking; tracks which booking is busy and the last error, per booking. */
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
