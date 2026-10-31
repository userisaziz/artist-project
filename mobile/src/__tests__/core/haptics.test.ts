import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import { haptic } from '../../core/motion/haptics';

const impact = Haptics.impactAsync as jest.Mock;
const originalOS = Platform.OS;
afterEach(() => {
  Platform.OS = originalOS;
  jest.clearAllMocks();
});

it('maps a tap to a light impact', () => {
  haptic('tap');
  expect(impact).toHaveBeenCalledWith('light');
});

it('maps a selection to the system tick', () => {
  haptic('select');
  expect(Haptics.selectionAsync).toHaveBeenCalledTimes(1);
});

it.each(['success', 'warning', 'error'] as const)('maps %s to a notification buzz', (kind) => {
  haptic(kind);
  expect(Haptics.notificationAsync).toHaveBeenCalledWith(kind);
});

it('stays silent on the web target', () => {
  Platform.OS = 'web';
  haptic('tap');
  expect(impact).not.toHaveBeenCalled();
});

it('swallows a device that cannot buzz', async () => {
  impact.mockRejectedValueOnce(new Error('no vibrator'));
  expect(() => haptic('tap')).not.toThrow();
  await Promise.resolve(); // the rejection is handled, so it never reaches the console
});
