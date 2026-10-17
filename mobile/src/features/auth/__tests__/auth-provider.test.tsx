import { render, screen, waitFor, act, fireEvent } from '@testing-library/react-native';
import { Text, Pressable } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { AuthProvider, useAuth, useMockOtpListener } from '../auth-provider';
import { transport } from '../../../core/api/client';
import { MockTransport } from '../../../core/api/mock/transport';
import * as authApi from '../api';

jest.mock('expo-secure-store', () => {
  const store = new Map<string, string>();
  return {
    setItemAsync: (k: string, v: string) => Promise.resolve(store.set(k, v)),
    getItemAsync: (k: string) => Promise.resolve(store.get(k) ?? null),
    deleteItemAsync: (k: string) => Promise.resolve(store.delete(k)),
    __store: store,
  };
});

const mock = transport as MockTransport;
const store = (SecureStore as unknown as { __store: Map<string, string> }).__store;
const statusIs = (s: string) => () => expect(screen.getByTestId('status').props.children).toBe(s);

let logSpy: jest.SpyInstance;
beforeEach(() => {
  store.clear();
  logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
});
afterEach(() => {
  logSpy.mockRestore();
});

// Each test gets its OWN phone: the MockTransport singleton shares cooldown state across tests.
// Assert exact status via props.children — toHaveTextContent('authenticated') would also match 'unauthenticated'.
function Probe({ phone }: { phone: string }) {
  const { status, user, requestOtp, verifyOtp, signOut } = useAuth();
  return (
    <>
      <Text testID="status">{status}</Text>
      <Text testID="user">{user?.phone ?? 'none'}</Text>
      <Pressable testID="flow" onPress={async () => {
        let code = '';
        mock.onOtpGenerated = (_p, c) => { code = c; };
        await requestOtp(phone);
        await verifyOtp(phone, code);
      }}><Text>flow</Text></Pressable>
      <Pressable testID="signout" onPress={() => { void signOut(); }}><Text>signout</Text></Pressable>
    </>
  );
}

const press = (id: string) => act(async () => { fireEvent.press(screen.getByTestId(id)); });

it('settles unauthenticated when no session is stored', async () => {
  await render(<AuthProvider><Probe phone="+15550002222" /></AuthProvider>);
  await waitFor(statusIs('unauthenticated'));
});

it('request → verify authenticates, persists tokens, exposes user', async () => {
  await render(<AuthProvider><Probe phone="+15550003333" /></AuthProvider>);
  await waitFor(statusIs('unauthenticated'));
  await press('flow');
  await waitFor(statusIs('authenticated'));
  expect(screen.getByTestId('user')).toHaveTextContent('+15550003333');
  expect(store.get('ac.access_token')).toBeTruthy();
  expect(store.get('ac.refresh_token')).toBeTruthy();
});

it('restore path: stored refresh token skips login on remount (simulates app restart)', async () => {
  const { unmount } = await render(<AuthProvider><Probe phone="+15550004444" /></AuthProvider>);
  await waitFor(statusIs('unauthenticated'));
  await press('flow');
  await waitFor(statusIs('authenticated'));
  await unmount();
  await render(<AuthProvider><Probe phone="+15550004444" /></AuthProvider>);
  await waitFor(statusIs('authenticated')); // never touched the login screen after restart
});

it('signOut clears the session', async () => {
  await render(<AuthProvider><Probe phone="+15550005555" /></AuthProvider>);
  await waitFor(statusIs('unauthenticated'));
  await press('flow');
  await waitFor(statusIs('authenticated'));
  await press('signout');
  await waitFor(statusIs('unauthenticated'));
  expect(store.size).toBe(0);
});

it('useMockOtpListener replays the latest generated code on mount', async () => {
  await authApi.requestOtp('+15550006666'); // generated before the listener mounts (Login → OTP screen)
  const cb = jest.fn();
  function Listener() {
    useMockOtpListener(cb);
    return null;
  }
  await render(<Listener />);
  expect(cb).toHaveBeenCalledWith('+15550006666', mock.lastOtp?.code);
  expect(cb.mock.calls[0][1]).toMatch(/^\d+$/);
});

it('settles unauthenticated (not stuck restoring) when SecureStore fails on cold start', async () => {
  jest.spyOn(SecureStore, 'getItemAsync').mockRejectedValueOnce(new Error('keystore unavailable'));
  await render(<AuthProvider><Probe phone="+15550007777" /></AuthProvider>);
  await waitFor(statusIs('unauthenticated'));
});
