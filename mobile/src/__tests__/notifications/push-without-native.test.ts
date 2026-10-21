import type * as Push from '../../core/push/push';

// Expo Go on Android has no push native modules: importing expo-notifications there throws.
jest.mock('expo-notifications', () => {
  throw new Error("Cannot find native module 'ExpoTopicSubscriptionModule'");
});

function loadPush(os: 'ios' | 'android', executionEnvironment: string): typeof Push {
  jest.doMock('expo-constants', () => ({
    __esModule: true,
    default: { executionEnvironment, expoConfig: { extra: { eas: { projectId: 'test-project' } } } },
    ExecutionEnvironment: { Bare: 'bare', Standalone: 'standalone', StoreClient: 'storeClient' },
  }));
  let push: typeof Push | undefined;
  jest.isolateModules(() => {
    const { Platform } = require('react-native');
    jest.replaceProperty(Platform, 'OS', os);
    push = require('../../core/push/push');
  });
  if (!push) throw new Error('push module did not load');
  return push;
}

afterEach(() => jest.restoreAllMocks());

it('loads in Expo Go on Android and turns pushes off instead of crashing the app', async () => {
  const push = loadPush('android', 'storeClient');

  expect(() => push.configureForegroundPushes()).not.toThrow();
  expect(push.onPushOpened(jest.fn())()).toBeUndefined();
  expect(push.onPushReceived(jest.fn())()).toBeUndefined();
  await expect(push.getPushToken()).resolves.toBeNull();
});

it('turns pushes off with a dev warning when a build is missing the native module', async () => {
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);

  const push = loadPush('ios', 'bare');

  expect(warn).toHaveBeenCalledWith(expect.stringContaining('Push notifications are off'), expect.any(Error));
  expect(push.onPushOpened(jest.fn())()).toBeUndefined();
  await expect(push.getPushToken()).resolves.toBeNull();
});
