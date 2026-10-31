import {
  BAD_DOB,
  FUTURE_DOB,
  TOO_YOUNG,
  ageYears,
  dateOfBirthInput,
  formatDateOfBirth,
  parseDateOfBirth,
  readDateOfBirth,
} from '../../utils/auth/date-of-birth';

// Pinned clock so the 18-year line is a fact in the test, not a drift of the day it runs.
const TODAY = new Date(Date.UTC(2026, 9, 31)); // 31 Oct 2026

it('masks typed digits into DD/MM/YYYY without trapping the caret', () => {
  expect(formatDateOfBirth('')).toBe('');
  expect(formatDateOfBirth('1')).toBe('1');
  expect(formatDateOfBirth('12')).toBe('12');
  expect(formatDateOfBirth('120')).toBe('12/0');
  expect(formatDateOfBirth('1204')).toBe('12/04');
  expect(formatDateOfBirth('12041995')).toBe('12/04/1995');
  expect(formatDateOfBirth('12/04/1995')).toBe('12/04/1995'); // re-formatting its own output is stable
  expect(formatDateOfBirth('120419951234')).toBe('12/04/1995'); // a ninth digit and beyond is dropped
});

it('reads a real calendar date into ISO, and nothing else', () => {
  expect(parseDateOfBirth('12/04/1995')).toBe('1995-04-12');
  expect(parseDateOfBirth('01/01/2000')).toBe('2000-01-01');
  expect(parseDateOfBirth('29/02/1996')).toBe('1996-02-29'); // leap year
  expect(parseDateOfBirth('29/02/1997')).toBeNull(); // not a leap year
  expect(parseDateOfBirth('31/02/1995')).toBeNull();
  expect(parseDateOfBirth('00/01/1995')).toBeNull();
  expect(parseDateOfBirth('32/01/1995')).toBeNull();
  expect(parseDateOfBirth('12/13/1995')).toBeNull();
  expect(parseDateOfBirth('12/04/199')).toBeNull(); // half-typed year
  expect(parseDateOfBirth('')).toBeNull();
});

it('round-trips a stored date of birth back into the field', () => {
  expect(dateOfBirthInput('1995-04-12')).toBe('12/04/1995');
  expect(dateOfBirthInput(null)).toBe('');
  expect(dateOfBirthInput(undefined)).toBe('');
  expect(dateOfBirthInput('nonsense')).toBe('');
});

it('counts full years, turning 18 on the birthday itself', () => {
  expect(ageYears('2008-10-31', TODAY)).toBe(18);
  expect(ageYears('2008-11-01', TODAY)).toBe(17); // the day after the birthday is still a year away
  expect(ageYears('2008-02-29', new Date(Date.UTC(2026, 1, 28)))).toBe(17); // 28 Feb: no birthday yet
  expect(ageYears('2008-02-29', new Date(Date.UTC(2026, 2, 1)))).toBe(18); // 1 Mar counts it, as the backend does
});

it('answers the field with the one message that fits', () => {
  expect(readDateOfBirth('12/04/1995', TODAY)).toEqual({ iso: '1995-04-12', error: null });
  expect(readDateOfBirth('12/04', TODAY)).toEqual({ iso: null, error: BAD_DOB });
  expect(readDateOfBirth('01/01/2027', TODAY)).toEqual({ iso: null, error: FUTURE_DOB });
  expect(readDateOfBirth('01/11/2008', TODAY)).toEqual({ iso: null, error: TOO_YOUNG });
  expect(readDateOfBirth('31/10/2008', TODAY).iso).toBe('2008-10-31'); // exactly 18 is adult
});
