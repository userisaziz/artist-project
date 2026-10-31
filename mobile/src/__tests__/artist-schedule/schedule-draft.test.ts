import { firstIssue } from '../../utils/common/validation';
import { scheduleDraftSchema } from '../../utils/artist-schedule/schedule-draft';

it('reads a radius typed in kilometres', () => {
  expect(scheduleDraftSchema.parse({ radius: '15' })).toEqual({ travel_radius_km: 15 });
});

it('treats an empty radius as not travelling', () => {
  expect(scheduleDraftSchema.parse({ radius: '' })).toEqual({ travel_radius_km: null });
  expect(scheduleDraftSchema.parse({ radius: '  ' })).toEqual({ travel_radius_km: null });
});

it('refuses fractions, zero and anything past 100 with the same words', () => {
  const said = 'Travel radius is a whole number from 1 to 100 km';
  expect(firstIssue(scheduleDraftSchema, { radius: '1.5' })).toBe(said);
  expect(firstIssue(scheduleDraftSchema, { radius: '0' })).toBe(said);
  expect(firstIssue(scheduleDraftSchema, { radius: '250' })).toBe(said);
});
