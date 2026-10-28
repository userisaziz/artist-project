import type { Transport, TransportRequest, TransportResponse } from './transport';
import { RealTransport } from './real-transport';
import { ApiError } from './types';

/** Single transport for every call: the real API client. */
export const transport: Transport = new RealTransport();

/** What the client needs back from a refresh; the auth feature's TokenPair satisfies it. */
export interface RefreshedSession { access_token: string }

export interface SessionBridge {
  getAccessToken: () => string | null;
  refreshSession: () => Promise<RefreshedSession | null>; // must return null on failure, never throw
  /** The server rejected a freshly refreshed token: the session is dead, sign out. */
  onUnauthorized: () => void;
  /** The refresh in flight, if any: a cold start opens on the remembered profile before it has an access token. */
  pendingRefresh?: () => Promise<unknown> | null;
}
let bridge: SessionBridge | null = null;
export function configureSessionBridge(b: SessionBridge | null): void { bridge = b; }

interface RequestOptions { auth?: boolean; method?: TransportRequest['method'] }

export async function request<T>(path: string, body?: unknown, opts: RequestOptions = {}): Promise<T> {
  const session = opts.auth ? bridge : null; // one bridge for the whole call, including the replay
  const send = (): Promise<TransportResponse> => {
    const token = session?.getAccessToken() ?? null; // read once: never a header built from a stale or null token
    return transport.request({
      method: opts.method ?? 'POST',
      path,
      body,
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
  };

  // A refresh in flight (the cold start's, or a rotation after a 401) is about to hand out the token this call needs:
  // wait for it instead of spending a round trip on a certain 401.
  const refreshing = session?.pendingRefresh?.();
  if (refreshing) await refreshing;
  let res = await send();
  if (res.status === 401 && session) {
    const pair = await session.refreshSession(); // the bridge dedupes concurrent refreshes
    if (!pair) throw toApiError(res);              // refresh failed → surface the original 401
    res = await send();                            // replay once with the new access token
    if (res.status === 401) session.onUnauthorized(); // a brand-new token rejected: nothing left to retry with
  }
  if (res.status >= 400) throw toApiError(res);
  return res.json as T; // 204 → null, fine for request<void>
}

interface ErrorBody { code?: unknown; message?: unknown; detail?: unknown }

function toApiError(res: TransportResponse): ApiError {
  const j: ErrorBody = typeof res.json === 'object' && res.json !== null ? res.json : {};
  const code = typeof j.code === 'string' ? j.code : null;
  // FastAPI's own errors carry `detail` instead of {code, message}: a string (HTTPException) or a list (422 schema).
  const detail = typeof j.detail === 'string' ? j.detail : firstFieldMessage(j.detail);
  if (!code && res.status === 422) return new ApiError('validation_error', detail || 'Invalid request', 422);
  const message = typeof j.message === 'string' ? j.message : detail;
  return new ApiError(code ?? 'server_error', message || 'Something went wrong. Please try again.', res.status);
}

/** First Pydantic field message, minus its "Value error, " prefix; null for anything that is not that shape. */
function firstFieldMessage(detail: unknown): string | null {
  if (!Array.isArray(detail)) return null;
  const first: unknown = detail[0];
  if (typeof first !== 'object' || first === null || !('msg' in first) || typeof first.msg !== 'string') return null;
  return first.msg.replace(/^Value error, /, '');
}
