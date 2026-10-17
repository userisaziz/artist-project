import { errorMessage, GENERIC_ERROR } from '../../core/api/error-message';
import { ApiError } from '../../core/api/types';

it('uses the override for a matching ApiError code', () => {
  expect(errorMessage(new ApiError('rate_limited', 'server text', 429), { rate_limited: 'Please wait' })).toBe('Please wait');
});

it('falls back to the ApiError message without an override', () => {
  expect(errorMessage(new ApiError('network_error', 'Network unreachable. Check your connection.', 0))).toBe('Network unreachable. Check your connection.');
});

it('falls back to generic for an ApiError with an empty message', () => {
  expect(errorMessage(new ApiError('server_error', '', 500))).toBe(GENERIC_ERROR);
});

it('maps non-ApiErrors to the generic message', () => {
  expect(errorMessage(new Error('boom'))).toBe('Something went wrong. Please try again.');
  expect(errorMessage('boom')).toBe(GENERIC_ERROR);
});
