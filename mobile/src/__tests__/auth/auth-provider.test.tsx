import { useEffect } from 'react';
import { Text } from 'react-native';
import { act, render, screen } from '@testing-library/react-native';
import { AuthProvider, useAuth } from '../../context/auth/auth-provider';
import type { AuthContextValue } from '../../context/auth/auth-provider';
import { request, transport } from '../../core/api/client';
import { queryClient } from '../../core/api/query-client';
import { ApiError } from '../../core/api/types';
import type { TransportRequest, TransportResponse } from '../../core/api/transport';
import { sessionStore } from '../../utils/auth/session-store';
import type { MemorySessionStore } from '../../mocks/auth/session-store';
import { authErrorBody, serviceUnavailableBody, tokenPairFixture, userFixture } from '../../mocks/auth/auth';

jest.mock('../../utils/auth/session-store', () => ({
  sessionStore: jest.requireActual('../../mocks/auth/session-store').createMemorySessionStore(),
}));

const store = sessionStore as MemorySessionStore;
const send = jest.spyOn(transport, 'request');
const clearCache = jest.spyOn(queryClient, 'clear');
const networkError = (): ApiError => new ApiError('network_error', 'Network unreachable. Check your connection.', 0);
const reply = (status: number, json: unknown = null): Promise<TransportResponse> => Promise.resolve({ status, json });

type Route = (req: TransportRequest) => Promise<TransportResponse>;
/** Answers by path; an unrouted call fails the test loudly instead of hanging. */
function routes(table: Record<string, Route>): void {
  send.mockImplementation((req) => {
    const route = table[req.path];
    if (!route) throw new Error(`unexpected request ${req.method} ${req.path}`);
    return route(req);
  });
}
const callsTo = (path: string): TransportRequest[] => send.mock.calls.map(([req]) => req).filter((req) => req.path === path);
const getBookings = (): Promise<unknown> => request('/bookings', undefined, { auth: true, method: 'GET' });

function deferred<T>(): { promise: Promise<T>; resolve: (v: T) => void } {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => { resolve = r; });
  return { promise, resolve };
}

let auth: AuthContextValue;
const capture = (value: AuthContextValue): void => { auth = value; };
function Probe({ onValue }: { onValue: (value: AuthContextValue) => void }) {
  const value = useAuth();
  useEffect(() => { onValue(value); });
  return <Text>{`status:${value.status}`}</Text>;
}
async function renderProvider(): Promise<void> {
  await render(<AuthProvider><Probe onValue={capture} /></AuthProvider>);
  await act(async () => {}); // let the cold-start restore settle
}
async function signedIn(): Promise<void> {
  store.refreshToken = 'refresh-0';
  routes({ '/auth/refresh': () => reply(200, tokenPairFixture(1)) });
  await renderProvider();
  expect(screen.getByText('status:authenticated')).toBeTruthy();
  send.mockClear();
}

beforeEach(() => {
  store.refreshToken = null;
  store.saves = [];
  send.mockReset();
  clearCache.mockClear();
});
afterAll(() => {
  send.mockRestore();
  clearCache.mockRestore();
});

describe('cold-start restore', () => {
  it('signs in with the stored refresh token and saves the rotated one', async () => {
    store.refreshToken = 'refresh-0';
    routes({ '/auth/refresh': () => reply(200, tokenPairFixture(1)) });

    await renderProvider();

    expect(screen.getByText('status:authenticated')).toBeTruthy();
    expect(auth.user?.id).toBe(userFixture.id);
    expect(callsTo('/auth/refresh')[0].body).toEqual({ refresh_token: 'refresh-0' });
    expect(store.refreshToken).toBe('refresh-1');
  });

  it('goes to login without calling the API when nothing is stored', async () => {
    routes({});
    await renderProvider();
    expect(screen.getByText('status:unauthenticated')).toBeTruthy();
    expect(send).not.toHaveBeenCalled();
  });

  it('treats a 401 from refresh as signed out and forgets the token', async () => {
    store.refreshToken = 'refresh-0';
    routes({ '/auth/refresh': () => reply(401, authErrorBody) });

    await renderProvider();

    expect(screen.getByText('status:unauthenticated')).toBeTruthy();
    expect(store.refreshToken).toBeNull();
    expect(clearCache).toHaveBeenCalled();
  });

  it('keeps the token and shows unavailable on a network error, then Retry signs in', async () => {
    store.refreshToken = 'refresh-0';
    routes({ '/auth/refresh': () => Promise.reject(networkError()) });

    await renderProvider();

    expect(screen.getByText('status:unavailable')).toBeTruthy();
    expect(store.refreshToken).toBe('refresh-0');

    routes({ '/auth/refresh': () => reply(200, tokenPairFixture(1)) });
    await act(() => auth.retryRestore());

    expect(screen.getByText('status:authenticated')).toBeTruthy();
    expect(store.refreshToken).toBe('refresh-1');
  });

  it.each([[503, serviceUnavailableBody], [429, { code: 'rate_limited', message: 'Too many requests' }]])(
    'keeps the token on a %i from refresh',
    async (status, body) => {
      store.refreshToken = 'refresh-0';
      routes({ '/auth/refresh': () => reply(status, body) });

      await renderProvider();

      expect(screen.getByText('status:unavailable')).toBeTruthy();
      expect(store.refreshToken).toBe('refresh-0');
    },
  );
});

describe('mid-session refresh', () => {
  it('shares one refresh between concurrent 401s', async () => {
    await signedIn();
    routes({
      '/auth/refresh': () => reply(200, tokenPairFixture(2)),
      '/bookings': (req) => (req.headers?.Authorization === 'Bearer access-2' ? reply(200, { items: [], next_cursor: null }) : reply(401, authErrorBody)),
    });

    await act(async () => { await Promise.all([getBookings(), getBookings()]); });

    expect(callsTo('/auth/refresh')).toHaveLength(1);
    expect(store.refreshToken).toBe('refresh-2');
  });

  it('keeps the session when refresh hits a network error and surfaces the original 401', async () => {
    await signedIn();
    routes({ '/auth/refresh': () => Promise.reject(networkError()), '/bookings': () => reply(401, authErrorBody) });

    let error: unknown;
    await act(async () => { error = await getBookings().catch((e: unknown) => e); });

    expect(error).toMatchObject({ code: 'auth_error', status: 401 });
    expect(screen.getByText('status:authenticated')).toBeTruthy();
    expect(store.refreshToken).toBe('refresh-1');
  });

  it('signs out when the replay after a successful refresh is still 401', async () => {
    await signedIn();
    routes({
      '/auth/refresh': () => reply(200, tokenPairFixture(2)),
      '/auth/logout': () => reply(204),
      '/bookings': () => reply(401, authErrorBody),
    });

    let error: unknown;
    await act(async () => { error = await getBookings().catch((e: unknown) => e); });

    expect(error).toMatchObject({ status: 401 });
    expect(screen.getByText('status:unauthenticated')).toBeTruthy();
    expect(store.refreshToken).toBeNull();
    expect(callsTo('/auth/logout')[0].body).toEqual({ refresh_token: 'refresh-2' });
  });

  it('stays signed out when sign-out lands during an in-flight refresh', async () => {
    await signedIn();
    const refresh = deferred<TransportResponse>();
    routes({
      '/auth/refresh': () => refresh.promise,
      '/auth/logout': () => reply(204),
      '/bookings': () => reply(401, authErrorBody),
    });

    let pending!: Promise<unknown>;
    await act(async () => { pending = getBookings().catch((e: unknown) => e); });
    await act(() => auth.signOut());
    await act(async () => {
      refresh.resolve({ status: 200, json: tokenPairFixture(2) });
      await pending;
    });

    expect(await pending).toMatchObject({ status: 401 });
    expect(screen.getByText('status:unauthenticated')).toBeTruthy();
    expect(auth.user).toBeNull();
    expect(store.refreshToken).toBeNull();
    expect(store.saves).not.toContain('refresh-2');
  });
});

describe('sign-in and sign-out', () => {
  it('signOut revokes the stored refresh token on the server and clears local state', async () => {
    await signedIn();
    routes({ '/auth/logout': () => reply(204) });

    await act(() => auth.signOut());

    expect(callsTo('/auth/logout')[0].body).toEqual({ refresh_token: 'refresh-1' });
    expect(screen.getByText('status:unauthenticated')).toBeTruthy();
    expect(store.refreshToken).toBeNull();
    expect(clearCache).toHaveBeenCalled();
  });

  it('signOut still signs out locally when the logout call fails', async () => {
    await signedIn();
    routes({ '/auth/logout': () => Promise.reject(networkError()) });

    await act(() => auth.signOut());

    expect(screen.getByText('status:unauthenticated')).toBeTruthy();
    expect(store.refreshToken).toBeNull();
  });

  it('runs sign-out cleanups first, while their requests are still signed, and not after unsubscribing', async () => {
    await signedIn();
    routes({ '/auth/logout': () => reply(204), '/bookings': () => reply(200, { items: [], next_cursor: null }) });
    const stopped = jest.fn();
    auth.onSignOut(() => { void getBookings(); });
    const unsubscribe = auth.onSignOut(stopped);
    unsubscribe();

    await act(() => auth.signOut());

    expect(callsTo('/bookings')[0].headers?.Authorization).toBe(`Bearer ${tokenPairFixture(1).access_token}`);
    expect(stopped).not.toHaveBeenCalled();
    expect(screen.getByText('status:unauthenticated')).toBeTruthy();
  });

  it('verifyOtp signs in and persists the refresh token', async () => {
    routes({ '/auth/otp/verify': () => reply(200, tokenPairFixture(1)) });
    await renderProvider();

    await act(() => auth.verifyOtp('+919876543210', '123456'));

    expect(screen.getByText('status:authenticated')).toBeTruthy();
    expect(store.refreshToken).toBe('refresh-1');
  });

  it('discards a verifyOtp result that lands after signOut', async () => {
    const verify = deferred<TransportResponse>();
    routes({ '/auth/otp/verify': () => verify.promise });
    await renderProvider();

    let pending!: Promise<void>;
    await act(async () => { pending = auth.verifyOtp('+919876543210', '123456'); });
    await act(() => auth.signOut());
    await act(async () => {
      verify.resolve({ status: 200, json: tokenPairFixture(1) });
      await pending;
    });

    expect(screen.getByText('status:unauthenticated')).toBeTruthy();
    expect(store.refreshToken).toBeNull();
  });
});
