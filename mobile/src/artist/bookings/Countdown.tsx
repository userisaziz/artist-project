import { StatusPill } from '../../components/StatusPill';
import { timeLeft } from '../../bookings/time';

/** "2h 14m left" until the artist must answer: amber, red under 30 minutes. */
export function Countdown({ deadline, now }: { deadline: string; now: number }) {
  const { label, urgent } = timeLeft(deadline, now);
  return <StatusPill label={label} tone={urgent ? 'danger' : 'pending'} />;
}
