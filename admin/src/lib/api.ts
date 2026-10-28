import type { TokenPair } from './types'
import { brand } from './brand'

// Fetch client for the Art Circle API.
// - The access token lives in memory only.
// - The refresh token is an HttpOnly `ac_refresh` cookie (Path=/api/v1/auth) set by the backend; this code
//   never sees it. Requests to /auth/otp/verify, /auth/refresh and /auth/logout opt into it with
//   `credentials: 'include'` + `X-Session-Transport`, and the JSON body carries `refresh_token: null`.
// - The only thing persisted is the non-secret "Keep me signed in" choice, so a refresh after a page
//   reload asks for the same kind of cookie (persistent vs. this browser session only).
// A 401 triggers one refresh, then a retry.

export const API_URL: string = import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api/v1'

const KEEP_SIGNED_IN_KEY = 'atelier-admin.keep-signed-in'
/** Where earlier builds kept the refresh token itself; purged on load. */
const LEGACY_REFRESH_KEY = 'atelier-admin.refresh'
const VALUE_ERROR_PREFIX = /^Value error, /
const GENERIC_MESSAGE = 'Something went wrong. Please try again.'

/** Raised when a mid-session refresh is refused: the app is already heading back to sign-in, so screens stay quiet. */
export const SESSION_EXPIRED = 'session_expired'

/** Every failed call becomes an ApiError; screens branch on `code` (the backend's stable contract). */
export class ApiError extends Error {
  readonly code: string
  readonly status: number
  constructor(code: string, message: string, status: number) {
    super(message)
    this.code = code
    this.status = status
  }
}

/** 'cookie': the refresh cookie survives browser restarts. 'cookie-session': it ends with the browser session. */
export type SessionTransport = 'cookie' | 'cookie-session'

/** ok: new access token in memory. expired: no valid refresh cookie (sign in again). unavailable: couldn't tell (offline, 5xx, 429). */
export type RefreshResult = 'ok' | 'expired' | 'unavailable'

let accessToken: string | null = null
let onExpired: (() => void) | null = null
let refreshing: Promise<RefreshResult> | null = null

const keepsSignedIn = (): boolean => localStorage.getItem(KEEP_SIGNED_IN_KEY) !== 'false'

/** Headers + credentials that let a request carry (and receive) the refresh cookie. */
export function cookieTransport(keepSignedIn: boolean = keepsSignedIn()): { headers: Record<string, string>; credentials: RequestCredentials } {
  const transport: SessionTransport = keepSignedIn ? 'cookie' : 'cookie-session'
  return { headers: { 'X-Session-Transport': transport }, credentials: 'include' }
}

export const session = {
  /** After a verified sign-in: keep the access token in memory and remember which cookie kind was asked for. */
  start(pair: TokenPair, keepSignedIn: boolean) {
    accessToken = pair.access_token
    localStorage.setItem(KEEP_SIGNED_IN_KEY, String(keepSignedIn))
  },
  /** Forget the in-memory access token (the cookie is the server's to revoke, via logout). */
  clear() {
    accessToken = null
  },
  /** Earlier builds stored the refresh token in web storage; make sure none is left behind. */
  purgeLegacyStorage() {
    localStorage.removeItem(LEGACY_REFRESH_KEY)
    sessionStorage.removeItem(LEGACY_REFRESH_KEY)
  },
  /** Called when a refresh is refused mid-session, so the app can drop back to sign-in. */
  onExpired(handler: (() => void) | null) {
    onExpired = handler
  },
}

/** First message of a FastAPI validation list, without pydantic's "Value error, " prefix. */
function detailMessage(detail: unknown): string | undefined {
  if (typeof detail === 'string') return detail
  if (!Array.isArray(detail)) return undefined
  const first: unknown = detail[0]
  const msg = typeof first === 'object' && first !== null && 'msg' in first ? first.msg : undefined
  return typeof msg === 'string' ? msg.replace(VALUE_ERROR_PREFIX, '') : undefined
}

async function toError(res: Response): Promise<ApiError> {
  const body = (await res.json().catch(() => ({}))) as { code?: string; message?: string; detail?: unknown } | null
  if (body?.code) return new ApiError(body.code, body.message ?? 'Request failed', res.status)
  const message = detailMessage(body?.detail)
  if (res.status === 422) return new ApiError('validation_error', message ?? 'Invalid request', 422)
  return new ApiError('server_error', message ?? GENERIC_MESSAGE, res.status)
}

async function requestRefresh(): Promise<RefreshResult> {
  let res: Response
  try {
    res = await fetch(`${API_URL}/auth/refresh`, { method: 'POST', ...cookieTransport() }) // no body: the cookie is the token
  } catch {
    return 'unavailable' // offline / DNS / CORS: the session may well still be valid
  }
  if (res.status === 401 || res.status === 403) {
    accessToken = null
    return 'expired'
  }
  if (!res.ok) return 'unavailable' // 429, 5xx: transient, keep the session
  const pair = (await res.json().catch(() => null)) as TokenPair | null
  if (!pair?.access_token) return 'unavailable'
  accessToken = pair.access_token
  return 'ok'
}

/** Trade the refresh cookie for a new access token. Concurrent callers share one request. */
export function refreshSession(): Promise<RefreshResult> {
  refreshing ??= requestRefresh().finally(() => {
    refreshing = null
  })
  return refreshing
}

/**
 * POST /auth/logout: the server revokes the refresh-token family and clears the cookie.
 * Resolves false (never rejects) when the server can't be reached, so callers decide explicitly what that means.
 */
export async function endSession(): Promise<boolean> {
  const token = accessToken
  accessToken = null
  const { headers, credentials } = cookieTransport()
  try {
    const res = await fetch(`${API_URL}/auth/logout`, {
      method: 'POST',
      credentials,
      headers: { ...headers, ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    })
    return res.ok
  } catch {
    return false
  }
}

export interface RequestOptions {
  method?: string
  body?: unknown
  /** Opt into the refresh cookie (sign-in only; refresh and logout have their own calls above). */
  transport?: ReturnType<typeof cookieTransport>
  /** 'text' for non-JSON downloads such as CSV exports. */
  parse?: 'json' | 'text'
}

export async function api<T>(path: string, init: RequestOptions = {}): Promise<T> {
  const send = () =>
    fetch(`${API_URL}${path}`, {
      method: init.method ?? 'GET',
      credentials: init.transport?.credentials,
      headers: {
        ...(init.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        ...init.transport?.headers,
      },
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    })

  let res = await send()
  if (res.status === 401 && !path.startsWith('/auth/')) {
    const refreshed = await refreshSession()
    if (refreshed === 'ok') res = await send()
    else if (refreshed === 'expired') {
      onExpired?.()
      throw new ApiError(SESSION_EXPIRED, 'Your session has expired. Please sign in again.', 401)
    } else throw new ApiError('service_unavailable', `Couldn’t reach ${brand.name}. Please try again.`, 503)
  }
  if (!res.ok) throw await toError(res)
  if (res.status === 204) return undefined as T
  if (init.parse === 'text') return (await res.text()) as T
  return (await res.json()) as T
}
