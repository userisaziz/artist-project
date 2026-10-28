import { Linking } from 'react-native';
import { LocationError, currentPosition, locationErrorMessage, openLocationSettings, POSITION_TIMEOUT_MS } from '../../core/location/location';

jest.mock('expo-location', () => ({
  Accuracy: { Balanced: 3 },
  getForegroundPermissionsAsync: jest.fn(),
  requestForegroundPermissionsAsync: jest.fn(),
  hasServicesEnabledAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
  getLastKnownPositionAsync: jest.fn(),
  reverseGeocodeAsync: jest.fn(),
}));
const mockLocation = jest.requireMock('expo-location') as Record<string, jest.Mock> & { Accuracy: object };


const fix = (latitude: number, longitude: number) => ({ coords: { latitude, longitude } });
const reason = async (p: Promise<unknown>) => p.then(() => 'ok', (e: unknown) => (e instanceof LocationError ? e.reason : e));

beforeEach(() => {
  jest.useRealTimers();
  Object.values(mockLocation).forEach((f) => { if (typeof f === 'function') (f as jest.Mock).mockReset(); });
  mockLocation.requestForegroundPermissionsAsync.mockResolvedValue({ granted: true, canAskAgain: true });
  mockLocation.getForegroundPermissionsAsync.mockResolvedValue({ granted: true, canAskAgain: true });
  mockLocation.hasServicesEnabledAsync.mockResolvedValue(true);
  mockLocation.getLastKnownPositionAsync.mockResolvedValue(null);
});

it('reads the position after the permission popup', async () => {
  mockLocation.getCurrentPositionAsync.mockResolvedValue(fix(12.9166, 77.6101));

  await expect(currentPosition()).resolves.toEqual({ latitude: 12.9166, longitude: 77.6101 });
  expect(mockLocation.requestForegroundPermissionsAsync).toHaveBeenCalled();
});

it('a silent check never shows the popup and says denied when not yet allowed', async () => {
  mockLocation.getForegroundPermissionsAsync.mockResolvedValue({ granted: false, canAskAgain: true });

  expect(await reason(currentPosition({ ask: false }))).toBe('denied');
  expect(mockLocation.requestForegroundPermissionsAsync).not.toHaveBeenCalled();
});

it('a permanent refusal is "blocked", so the screen can offer Settings', async () => {
  mockLocation.requestForegroundPermissionsAsync.mockResolvedValue({ granted: false, canAskAgain: false });
  const opened = jest.spyOn(Linking, 'openSettings').mockResolvedValue(undefined);

  const why = await reason(currentPosition());
  await openLocationSettings();

  expect(why).toBe('blocked');
  expect(locationErrorMessage(new LocationError('blocked'))).toMatch(/Settings/);
  expect(opened).toHaveBeenCalled();
});

it('location switched off on the phone is "off"', async () => {
  mockLocation.hasServicesEnabledAsync.mockResolvedValue(false);

  expect(await reason(currentPosition())).toBe('off');
  expect(mockLocation.getCurrentPositionAsync).not.toHaveBeenCalled();
});

it('falls back to the last known position when no fix comes in time', async () => {
  jest.useFakeTimers();
  mockLocation.getCurrentPositionAsync.mockReturnValue(new Promise(() => {}));
  mockLocation.getLastKnownPositionAsync.mockResolvedValue(fix(12.93, 77.62));

  const position = currentPosition();
  await jest.advanceTimersByTimeAsync(POSITION_TIMEOUT_MS);

  await expect(position).resolves.toEqual({ latitude: 12.93, longitude: 77.62 });
});

it('with no fix and nothing remembered, it is unavailable', async () => {
  mockLocation.getCurrentPositionAsync.mockRejectedValue(new Error('no fix'));

  expect(await reason(currentPosition())).toBe('unavailable');
});
