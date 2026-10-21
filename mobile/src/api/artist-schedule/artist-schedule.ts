import { request } from '../../core/api/client';
import type { Schedule, ScheduleInput } from '../../types/artist-schedule/artist-schedule';

const SCHEDULE = '/artists/me/schedule';

export function getSchedule() {
  return request<Schedule>(SCHEDULE, undefined, { auth: true, method: 'GET' });
}
export function saveSchedule(body: ScheduleInput) {
  return request<Schedule>(SCHEDULE, body, { auth: true, method: 'PUT' });
}
/** `day` is an IST date, 'YYYY-MM-DD'. Both calls are idempotent and return the whole schedule. */
export function addDayOff(day: string) {
  return request<Schedule>(`${SCHEDULE}/days-off/${encodeURIComponent(day)}`, undefined, { auth: true, method: 'PUT' });
}
export function removeDayOff(day: string) {
  return request<Schedule>(`${SCHEDULE}/days-off/${encodeURIComponent(day)}`, undefined, { auth: true, method: 'DELETE' });
}
