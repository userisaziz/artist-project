import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as scheduleApi from '../../api/artist-schedule/artist-schedule';
import { useAuth } from '../../context/auth/auth-provider';
import type { Schedule, ScheduleInput } from '../../types/artist-schedule/artist-schedule';

// Keyed by user id, so another account on the device never sees a cached schedule.
export const scheduleKeys = { mine: (userId: string | undefined) => ['artist-schedule', userId] as const };

export function useSchedule() {
  const { user } = useAuth();
  return useQuery({ queryKey: scheduleKeys.mine(user?.id), queryFn: scheduleApi.getSchedule, enabled: !!user });
}

/** Every schedule write returns the whole schedule, which replaces the cached one. */
function useScheduleWrite<TVars>(write: (vars: TVars) => Promise<Schedule>) {
  const { user } = useAuth();
  const client = useQueryClient();
  return useMutation({ mutationFn: write, onSuccess: (schedule) => client.setQueryData(scheduleKeys.mine(user?.id), schedule) });
}

export const useSaveSchedule = () => useScheduleWrite((input: ScheduleInput) => scheduleApi.saveSchedule(input));
export const useSetDayOff = () =>
  useScheduleWrite(({ day, off }: { day: string; off: boolean }) => (off ? scheduleApi.addDayOff(day) : scheduleApi.removeDayOff(day)));
