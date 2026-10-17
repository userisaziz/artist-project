import { addDays, formatDay, formatLongDay, formatTime, formatWhen, greeting, istDateKey, istDayStart, monthGrid, timeLeft } from '../../utils/common/time';

it('IST date keys and day starts ignore the device time zone', () => {
  expect(istDateKey(Date.parse('2026-10-19T18:29:00.000Z'))).toBe('2026-10-19'); // 23:59 IST
  expect(istDateKey(Date.parse('2026-10-19T18:30:00.000Z'))).toBe('2026-10-20'); // 00:00 IST
  expect(new Date(istDayStart('2026-10-20')).toISOString()).toBe('2026-10-19T18:30:00.000Z');
  expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
  expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
});

it('formats times and days in IST', () => {
  expect(formatTime('2026-10-09T05:30:00.000Z')).toBe('11:00 AM');
  expect(formatTime('2026-10-09T08:30:00.000Z')).toBe('2:00 PM');
  expect(formatTime('2026-10-09T06:30:00.000Z')).toBe('12:00 PM');
  expect(formatDay('2026-10-09')).toBe('Fri, 9 Oct');
  expect(formatWhen('2026-10-09T05:30:00.000Z')).toBe('Fri, 9 Oct · 11:00 AM');
  expect(formatLongDay('2026-10-08')).toBe('Thursday, 8 October');
});

it('greets by the IST hour', () => {
  expect(greeting(Date.parse('2026-10-09T03:00:00.000Z'))).toBe('Good morning');   // 08:30
  expect(greeting(Date.parse('2026-10-09T08:00:00.000Z'))).toBe('Good afternoon'); // 13:30
  expect(greeting(Date.parse('2026-10-09T13:00:00.000Z'))).toBe('Good evening');   // 18:30
});

it('timeLeft reads hours and minutes, and flags the last 30 minutes', () => {
  const now = 0;
  expect(timeLeft(new Date((2 * 60 + 14) * 60_000 + 30_000).toISOString(), now)).toEqual({ label: '2h 14m left', urgent: false, over: false });
  expect(timeLeft(new Date(29 * 60_000).toISOString(), now)).toEqual({ label: '29m left', urgent: true, over: false });
  expect(timeLeft(new Date(0).toISOString(), now)).toEqual({ label: 'Expired', urgent: true, over: true });
});

it('monthGrid pads to whole weeks starting on Sunday', () => {
  const grid = monthGrid(2026, 10); // October 2026 starts on a Thursday
  expect(grid.length % 7).toBe(0);
  expect(grid.slice(0, 4)).toEqual([null, null, null, null]);
  expect(grid[4]).toBe('2026-10-01');
  expect(grid.filter(Boolean)).toHaveLength(31);
});
