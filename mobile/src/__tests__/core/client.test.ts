import { configureSessionBridge, request, transport } from '../../core/api/client';
import type { SessionBridge } from '../../core/api/client';
import { ApiError } from '../../core/api/types';
import type { TransportRequest, TransportResponse } from '../../core/api/transport';

// The client is tested against a mocked transport: no global.fetch is touched, so nothing leaks between files.
const send = jest.spyOn(transport, 'request');
const reply = (status: number, json: unknown = null): TransportResponse => ({ status, json });
const authHeader = (call: number): string | undefined => (send.mock.calls[call][0] as TransportRequest).headers?.Authorization;

function bridge(overrides: Partial<SessionBridge> = {}): SessionBridge {
  return {
    getAccessToken: jest.fn(() => 'old-access'),
    refreshSession: jest.fn(async () => ({ access_token: 'new-access' })),
    onUnauthorized: jest.fn(),
    ...overrides,
  };
}

afterEach(() => {
  send.mockReset();
  configureSessionBridge(null);
});
afterAll(() => {
  send.mockRestore();
});

describe('error mapping', () => {
  it('surfaces a FastAPI 422 as validation_error with the first field message', async () => {
    send.mockResolvedValue(reply(422, {
      detail: [{ loc: ['body', 'phone'], msg: 'Value error, phone must be E.164 format, e.g. +15550001111', type: 'value_error' }],
    }));
    const p = request('/auth/otp/request', { phone: '123' });
    await expect(p).rejects.toBeInstanceOf(ApiError);
    await expect(p).rejects.toMatchObject({ code: 'validation_error', status: 422, message: 'phone must be E.164 format, e.g. +15550001111' });
  });

  it('keeps the backend {code, message} contract for domain errors', async () => {
    send.mockResolvedValue(reply(429, { code: 'rate_limited', message: 'Please wait before requesting another code' }));
    await expect(request('/auth/otp/request', { phone: '+15550001111' })).rejects.toMatchObject({
      code: 'rate_limited',
      message: 'Please wait before requesting another code',
    });
  });

  it('uses a string detail (FastAPI HTTPException) as the message', async () => {
    send.mockResolvedValue(reply(404, { detail: 'Not Found' }));
    await expect(request('/nope', undefined, { method: 'GET' })).rejects.toMatchObject({ code: 'server_error', status: 404, message: 'Not Found' });
  });

  it('does not crash on a 422 whose detail is a string rather than a list', async () => {
    send.mockResolvedValue(reply(422, { detail: 'Bad payload' }));
    await expect(request('/x', {})).rejects.toMatchObject({ code: 'validation_error', status: 422, message: 'Bad payload' });
  });

  it('falls back to a generic message for a 422 with an empty detail list', async () => {
    send.mockResolvedValue(reply(422, { detail: [] }));
    await expect(request('/x', {})).rejects.toMatchObject({ code: 'validation_error', message: 'Invalid request' });
  });

  it('maps a bodiless 5xx to server_error', async () => {
    send.mockResolvedValue(reply(502, null));
    await expect(request('/x', {})).rejects.toMatchObject({ code: 'server_error', status: 502 });
  });
});

describe('success', () => {
  it('returns null for a 204', async () => {
    send.mockResolvedValue(reply(204));
    await expect(request<void>('/auth/logout', { refresh_token: 'r' })).resolves.toBeNull();
  });

  it('sends the bearer token on auth calls, reading it once', async () => {
    const b = bridge();
    configureSessionBridge(b);
    send.mockResolvedValue(reply(200, { ok: true }));
    await request('/me', undefined, { auth: true, method: 'GET' });
    expect(authHeader(0)).toBe('Bearer old-access');
    expect(b.getAccessToken).toHaveBeenCalledTimes(1);
  });

  it('never sends "Bearer null" when no access token is held', async () => {
    configureSessionBridge(bridge({ getAccessToken: jest.fn(() => null) }));
    send.mockResolvedValue(reply(200, {}));
    await request('/me', undefined, { auth: true, method: 'GET' });
    expect(send.mock.calls[0][0].headers).toBeUndefined();
  });
});

describe('401 handling', () => {
  it('refreshes once and replays the request with the new access token', async () => {
    let token = 'old-access';
    const b = bridge({
      getAccessToken: jest.fn(() => token),
      refreshSession: jest.fn(async () => { token = 'new-access'; return { access_token: token }; }),
    });
    configureSessionBridge(b);
    send.mockResolvedValueOnce(reply(401, { code: 'auth_error', message: 'expired' })).mockResolvedValueOnce(reply(200, { id: 1 }));

    await expect(request('/me', undefined, { auth: true, method: 'GET' })).resolves.toEqual({ id: 1 });
    expect(b.refreshSession).toHaveBeenCalledTimes(1);
    expect(authHeader(0)).toBe('Bearer old-access');
    expect(authHeader(1)).toBe('Bearer new-access');
    expect(b.onUnauthorized).not.toHaveBeenCalled();
  });

  it('surfaces the original 401 when the refresh fails', async () => {
    const b = bridge({ refreshSession: jest.fn(async () => null) });
    configureSessionBridge(b);
    send.mockResolvedValue(reply(401, { code: 'auth_error', message: 'Token expired' }));

    await expect(request('/me', undefined, { auth: true, method: 'GET' })).rejects.toMatchObject({ code: 'auth_error', status: 401, message: 'Token expired' });
    expect(send).toHaveBeenCalledTimes(1); // no replay without a fresh token
    expect(b.onUnauthorized).not.toHaveBeenCalled();
  });

  it('calls onUnauthorized when the replay after a successful refresh is still 401', async () => {
    const b = bridge();
    configureSessionBridge(b);
    send.mockResolvedValue(reply(401, { code: 'auth_error', message: 'nope' }));

    await expect(request('/me', undefined, { auth: true, method: 'GET' })).rejects.toMatchObject({ status: 401 });
    expect(send).toHaveBeenCalledTimes(2);
    expect(b.onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it('does not refresh for unauthenticated calls', async () => {
    const b = bridge();
    configureSessionBridge(b);
    send.mockResolvedValue(reply(401, { code: 'auth_error', message: 'Invalid code' }));

    await expect(request('/auth/otp/verify', { phone: '+15550001111', code: '000000' })).rejects.toMatchObject({ status: 401 });
    expect(b.refreshSession).not.toHaveBeenCalled();
  });
});
