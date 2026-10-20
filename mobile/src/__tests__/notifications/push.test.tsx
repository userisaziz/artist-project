import type { ReactNode } from 'react';
import { renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as Notifications from 'expo-notifications';
import { transport } from '../../core/api/client';
import type { TransportRequest } from '../../core/api/transport';
import { usePushNotifications } from '../../hooks/notifications/use-push';

const signOutCleanups: (() => void)[] = [];
jest.mock('../../context/auth/auth-provider', () => ({
  useAuth: () => ({
    user: jest.requireActual('../../mocks/auth/auth').userFixture,
    onSignOut: (cleanup: () => void) => { signOutCleanups.push(cleanup); return () => undefined; },
  }),
}));
jest.mock('expo-constants', () => ({ expoConfig: { extra: { eas: { projectId: 'test-project' } } } }));

type Opened = (response: unknown) => void;
let tapListener: Opened | null = null;
jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  setNotificationChannelAsync: jest.fn(),
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  getExpoPushTokenAsync: jest.fn(async () => ({ data: 'ExponentPushToken[abc123]' })),
  getLastNotificationResponse: jest.fn(() => null),
  addNotificationResponseReceivedListener: jest.fn((fn: Opened) => { tapListener = fn; return { remove: jest.fn() }; }),
  addNotificationReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  AndroidImportance: { HIGH: 4 },
}));
const permissions = Notifications.getPermissionsAsync as jest.Mock;
const ask = Notifications.requestPermissionsAsync as jest.Mock;

const send = jest.spyOn(transport, 'request');
const sent: TransportRequest[] = [];
let client: QueryClient;
const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;

const tap = (id: string, link: unknown) =>
  tapListener?.({ notification: { request: { identifier: id, content: { data: { link } } } } });

beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  sent.length = 0;
  signOutCleanups.length = 0;
  tapListener = null;
  send.mockReset();
  send.mockImplementation(async (req: TransportRequest) => { sent.push(req); return { status: 204, json: null }; });
  permissions.mockResolvedValue({ granted: true, canAskAgain: true });
});
afterEach(() => client.clear());
afterAll(() => send.mockRestore());

it('registers this device after sign-in and unregisters it on sign-out', async () => {
  renderHook(() => usePushNotifications(jest.fn()), { wrapper });

  await waitFor(() => expect(sent.map((r) => r.path)).toEqual(['/notifications/devices']));
  expect(sent[0].body).toEqual({ token: 'ExponentPushToken[abc123]', platform: expect.stringMatching(/^(ios|android)$/) });

  await waitFor(() => expect(signOutCleanups).toHaveLength(1));
  signOutCleanups[0]();
  await waitFor(() => expect(sent.map((r) => r.path)).toEqual(['/notifications/devices', '/notifications/devices/remove']));
});

it('registers nothing when the person refuses notifications', async () => {
  permissions.mockResolvedValue({ granted: false, canAskAgain: true });
  ask.mockResolvedValue({ granted: false });

  renderHook(() => usePushNotifications(jest.fn()), { wrapper });

  await waitFor(() => expect(ask).toHaveBeenCalled());
  expect(sent).toEqual([]);
});

it('opens the link of a tapped push, and ignores links that are not in-app paths', async () => {
  const navigate = jest.fn();
  renderHook(() => usePushNotifications(navigate), { wrapper });
  await waitFor(() => expect(tapListener).not.toBeNull());

  tap('p-1', '/customer/booking/b-1');
  tap('p-2', 'https://evil.example/phish');
  tap('p-3', '//evil.example');

  expect(navigate.mock.calls).toEqual([['/customer/booking/b-1']]);
});
