import { formatAadhaar, isValidAadhaar } from '../../utils/artist-onboarding/aadhaar';

// Generated numbers (not real people): the same ones the backend tests use (tests/test_aadhaar.py).
const VALID = ['234123412346', '498765432102', '567812345678'];
const INVALID = [
  '234123412347',   // checksum off by one
  '034123412346',   // leading 0
  '134123412346',   // leading 1
  '23412341234',    // 11 digits
  '2341234123460',  // 13 digits
  '2341 2341 2346', // callers strip spaces first
  '23412341234a',
  '',
];

it('accepts Verhoeff-valid 12-digit numbers', () => {
  expect(VALID.filter((n) => !isValidAadhaar(n))).toEqual([]);
});

it('rejects a bad checksum, a leading 0 or 1, wrong lengths, spaces and non-digits', () => {
  expect(INVALID.filter(isValidAadhaar)).toEqual([]);
});

it('groups digits in fours for display, including partial input', () => {
  expect(formatAadhaar('')).toBe('');
  expect(formatAadhaar('2341')).toBe('2341');
  expect(formatAadhaar('23412')).toBe('2341 2');
  expect(formatAadhaar('234123412346')).toBe('2341 2341 2346');
});
