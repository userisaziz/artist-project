import * as SecureStore from 'expo-secure-store';
import { sessionStore } from '../../utils/auth/session-store';

jest.mock('expo-secure-store', () => {
  const items = new Map<string, string>();
  return {
    setItemAsync: jest.fn(async (k: string, v: string) => { items.set(k, v); }),
    getItemAsync: jest.fn(async (k: string) => items.get(k) ?? null),
    deleteItemAsync: jest.fn(async (k: string) => { items.delete(k); }),
  };
});

const pair = { access_token: 'access', refresh_token: 'refresh', token_type: 'bearer' as const, user: {} as never };

it('persists only the refresh token: the access token lives in memory', async () => {
  await sessionStore.save(pair);
  expect(await sessionStore.getRefreshToken()).toBe('refresh');
  expect(SecureStore.setItemAsync).toHaveBeenCalledTimes(1);
  expect(SecureStore.setItemAsync).toHaveBeenCalledWith('ac.refresh_token', 'refresh');
});

it('clear removes the refresh token and any access token left by older builds', async () => {
  await sessionStore.save(pair);
  await sessionStore.clear();
  expect(await sessionStore.getRefreshToken()).toBeNull();
  expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('ac.access_token');
});

describe('web fallback', () => {
  const dev = (global as { __DEV__?: boolean }).__DEV__;
  afterEach(() => {
    (global as { __DEV__?: boolean }).__DEV__ = dev;
    jest.restoreAllMocks();
  });
  const loadOnWeb = (): unknown => {
    let mod: unknown;
    jest.isolateModules(() => {
      jest.requireActual<typeof import('react-native')>('react-native').Platform.OS = 'web';
      mod = jest.requireActual('../../utils/auth/session-store');
    });
    return mod;
  };

  it('refuses localStorage tokens in a production web build', () => {
    (global as { __DEV__?: boolean }).__DEV__ = false;
    expect(loadOnWeb).toThrow(/web/i);
  });

  it('allows the localStorage fallback in development', () => {
    (global as { __DEV__?: boolean }).__DEV__ = true;
    expect(loadOnWeb()).toHaveProperty('sessionStore');
  });
});
