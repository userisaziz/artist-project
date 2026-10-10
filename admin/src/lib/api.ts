import type { TokenPair } from './types'

// Fetch client for the Art Circle API. The access token lives in memory only; the refresh
// token is in localStorage ("Keep me signed in") or sessionStorage (this browser session only).
// Internal tool — move it to an httpOnly cookie before this app is ever public.
// A 401 triggers one refresh, then a retry.

export const API_URL: string = import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api/v1'
const REFRESH_KEY = 'atelier-admin.refresh'

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

let accessToken: string | null = null
let remember = true
let onExpired: (() => void) | null = null
let refreshing: Promise<boolean> | null = null

const storedRefreshToken = () => localStorage.getItem(REFRESH_KEY) ?? sessionStorage.getItem(REFRESH_KEY)

export const session = {
  /** `keep`: survive browser restarts (localStorage) vs. this session only (sessionStorage). */
  store(pair: TokenPair, keep: boolean = remember) {
    accessToken = pair.access_token
    remember = keep
    ;(keep ? localStorage : sessionStorage).setItem(REFRESH_KEY, pair.refresh_token)
    ;(keep ? sessionStorage : localStorage).removeItem(REFRESH_KEY)
  },
  clear() {
    accessToken = null
    localStorage.removeItem(REFRESH_KEY)
    sessionStorage.removeItem(REFRESH_KEY)
  },
  hasRefreshToken: () => storedRefreshToken() !== null,
  /** Called when a refresh fails mid-session, so the app can drop back to sign-in. */
  onExpired(handler: (() => void) | null) {
    onExpired = handler
  },
}

async function toError(res: Response): Promise<ApiError> {
  const body = (await res.json().catch(() => ({}))) as { code?: string; message?: string; detail?: { msg?: string }[] }
  if (body.code) return new ApiError(body.code, body.message ?? 'Request failed', res.status)
  if (res.status === 422) return new ApiError('validation_error', body.detail?.[0]?.msg ?? 'Invalid request', 422)
  return new ApiError('server_error', 'Something went wrong. Please try again.', res.status)
}

/** Swap the stored refresh token for a new pair. Concurrent callers share one request. */
export function refreshSession(): Promise<boolean> {
  const token = storedRefreshToken()
  if (!token) return Promise.resolve(false)
  remember = localStorage.getItem(REFRESH_KEY) !== null // a rotated token goes back where it came from
  refreshing ??= fetch(`${API_URL}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: token }),
  })
    .then(async (res) => {
      if (!res.ok) {
        session.clear()
        return false
      }
      session.store((await res.json()) as TokenPair)
      return true
    })
    .catch(() => false)
    .finally(() => {
      refreshing = null
    })
  return refreshing
}

export async function api<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const send = () =>
    fetch(`${API_URL}${path}`, {
      method: init.method ?? 'GET',
      headers: {
        ...(init.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    })

  let res = await send()
  if (res.status === 401 && !path.startsWith('/auth/')) {
    if (await refreshSession()) res = await send()
    else onExpired?.()
  }
  if (!res.ok) throw await toError(res)
  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}
