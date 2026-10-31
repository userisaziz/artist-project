import { z } from 'zod';

/** Matches backend artist schedule travel_radius_km 1..100. */
export const RADIUS_MAX = 100;

/** The travel radius as the artist typed it — empty means they don't travel. */
export interface ScheduleDraft {
  radius: string;
}

/** What goes to the API once the radius text has been read as kilometres. */
export interface SchedulePatch {
  travel_radius_km: number | null;
}

/**
 * The travel radius, read once and said back in the artist's own words.
 *
 * The open/close hours are not checked here: the steppers cannot move a day past `close > open`, so the
 * only way to type something wrong on this screen is the radius field.
 */
export const scheduleDraftSchema = z
  .object({
    radius: z.string().transform((text, report) => {
      if (!text.trim()) return null;
      const km = Number(text);
      if (!Number.isInteger(km) || km < 1 || km > RADIUS_MAX) {
        report.addIssue({ code: 'custom', message: `Travel radius is a whole number from 1 to ${RADIUS_MAX} km` });
        return z.NEVER;
      }
      return km;
    }),
  })
  .transform((draft): SchedulePatch => ({ travel_radius_km: draft.radius }));
