import type { Transport } from './transport';
import { RealTransport } from './real-transport';
import { MockTransport } from './mock/transport';
import { ApiError } from './types';
import type { TokenPair } from './types';

/** THE parallel-build seam: one line decides mock vs real for the whole app. */
export const transport: Transport =
  process.env.EXPO_PUBLIC_USE_MOCKS === 'true' ? new MockTransport() : new RealTransport();

export interface SessionBridge {
  getAccessToken: () => string | null;
  refreshSession: () => Promise<TokenPair | null>; // must return null on failure, never throw
}
let bridge: SessionBridge | null = null;
export function configureSessionBridge(b: SessionBridge | null) { bridge = b; }

export async function request<T>(path: string, body?: unknown, opts: { auth?: boolean } = {}): Promise<T> {
  const call = () =>
    transport.request({
      method: 'POST',
      path,
      body,
      headers: opts.auth && bridge?.getAccessToken() ? { Authorization: `Bearer ${bridge.getAccessToken()}` } : undefined,
    });

  let res = await call();
  if (res.status === 401 && opts.auth && bridge) {
    const pair = await bridge.refreshSession(); // bridge dedupes concurrent refreshes
    if (!pair) throw toApiError(res);           // refresh failed → surface the original 401
    res = await call();                          // replay once with the new access token
  }
  if (res.status >= 400) throw toApiError(res);
  return res.json as T; // 204 → null, fine for request<void>
}

function toApiError(res: { status: number; json: unknown }): ApiError {
  const j = (res.json ?? {}) as { code?: string; message?: string };
  return new ApiError(
    j.code ?? 'server_error',
    j.message ?? 'Something went wrong. Please try again.',
    res.status,
  );
}
