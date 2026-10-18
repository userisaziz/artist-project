import { useEffect, useState } from 'react';

const DEFAULT_DELAY_MS = 300;

/** `value`, updated only once it has stopped changing for `delayMs` (search boxes). */
export function useDebouncedValue<T>(value: T, delayMs = DEFAULT_DELAY_MS): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return settled;
}
