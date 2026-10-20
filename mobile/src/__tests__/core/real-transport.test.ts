import { RealTransport, REQUEST_TIMEOUT_MS } from '../../core/api/real-transport';
import { ApiError } from '../../core/api/types';

const req = { method: 'POST' as const, path: '/auth/otp/request', body: { phone: '+15550001111' } };
const fetchMock = jest.fn();
const response = (status: number, json: () => Promise<unknown>) => ({ status, json });

beforeEach(() => {
  fetchMock.mockReset();
  global.fetch = fetchMock as unknown as typeof fetch;
});
afterEach(() => {
  jest.useRealTimers();
});

it('returns parsed JSON for a 200', async () => {
  fetchMock.mockResolvedValue(response(200, () => Promise.resolve({ ok: true })));
  await expect(new RealTransport().request(req)).resolves.toEqual({ status: 200, json: { ok: true } });
});

it('returns null JSON for a 204 without parsing', async () => {
  const json = jest.fn();
  fetchMock.mockResolvedValue(response(204, json));
  await expect(new RealTransport().request(req)).resolves.toEqual({ status: 204, json: null });
  expect(json).not.toHaveBeenCalled();
});

it('throws server_error for a 2xx with an unparseable body', async () => {
  fetchMock.mockResolvedValue(response(200, () => Promise.reject(new SyntaxError('bad json'))));
  await expect(new RealTransport().request(req)).rejects.toMatchObject({ code: 'server_error', status: 200 });
});

it('keeps a non-2xx unparseable body as null JSON (client maps it)', async () => {
  fetchMock.mockResolvedValue(response(502, () => Promise.reject(new SyntaxError('html'))));
  await expect(new RealTransport().request(req)).resolves.toEqual({ status: 502, json: null });
});

it('maps a fetch rejection to network_error', async () => {
  fetchMock.mockRejectedValue(new TypeError('Network request failed'));
  const p = new RealTransport().request(req);
  await expect(p).rejects.toBeInstanceOf(ApiError);
  await expect(p).rejects.toMatchObject({ code: 'network_error', status: 0 });
});

it('aborts a hung request after the timeout as network_error', async () => {
  jest.useFakeTimers();
  fetchMock.mockImplementation((_url: string, init: { signal?: AbortSignal }) => new Promise((_resolve, reject) => {
    init.signal?.addEventListener('abort', () => reject(new Error('Aborted')));
  }));
  const p = new RealTransport().request(req);
  const assertion = expect(p).rejects.toMatchObject({ code: 'network_error', status: 0 });
  jest.advanceTimersByTime(REQUEST_TIMEOUT_MS);
  await assertion;
});

describe('API base URL', () => {
  const env = process.env.EXPO_PUBLIC_API_URL;
  const dev = (global as { __DEV__?: boolean }).__DEV__;
  afterEach(() => {
    process.env.EXPO_PUBLIC_API_URL = env;
    (global as { __DEV__?: boolean }).__DEV__ = dev;
  });
  const load = (): unknown => {
    let mod: unknown;
    jest.isolateModules(() => { mod = jest.requireActual('../../core/api/real-transport'); });
    return mod;
  };

  it('falls back to localhost in development', () => {
    delete process.env.EXPO_PUBLIC_API_URL;
    (global as { __DEV__?: boolean }).__DEV__ = true;
    expect(load()).toHaveProperty('BASE_URL', 'http://localhost:8000');
  });

  it('refuses to start a release build without EXPO_PUBLIC_API_URL', () => {
    delete process.env.EXPO_PUBLIC_API_URL;
    (global as { __DEV__?: boolean }).__DEV__ = false;
    expect(load).toThrow(/EXPO_PUBLIC_API_URL/);
  });

  it('uses the configured URL without a trailing slash', () => {
    process.env.EXPO_PUBLIC_API_URL = 'https://api.example.com/';
    (global as { __DEV__?: boolean }).__DEV__ = false;
    expect(load()).toHaveProperty('BASE_URL', 'https://api.example.com');
  });
});
