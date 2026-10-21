import type { WeeklyHour } from '../../utils/common/weekly-hours';

/** GET/PUT /artists/me/schedule (backend app/artist schedule routes). */
export interface Schedule {
  hours: WeeklyHour[];
  /** IST dates, today onward, ascending: 'YYYY-MM-DD'. */
  days_off: string[];
  /** Display only: how far the artist travels, in km. */
  travel_radius_km: number | null;
}

export type ScheduleInput = Pick<Schedule, 'hours' | 'travel_radius_km'>;
