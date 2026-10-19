import { useMutation } from '@tanstack/react-query'
import { api, ApiError, cookieTransport, endSession, session } from '@/lib/api'
import type { TokenPair, User } from '@/lib/types'

// Auth request declarations: types + fetchers + react-query hooks, kept out of the provider
// so AuthProvider only orchestrates session state and screens never call fetch directly.

export const NOT_ADMIN = "This account isn't an admin."

/** Ask the backend to text an OTP to a staff phone (E.164, e.g. "+919886012345"). */
export function requestOtp(phone: string): Promise<void> {
  return api<void>('/auth/otp/request', { method: 'POST', body: { phone } })
}

/**
 * Exchange phone + 6-digit code for an access token. The backend sets the refresh token as an HttpOnly
 * cookie (persistent when `keepSignedIn`, else for this browser session) and returns refresh_token: null.
 */
export function verifyOtp(phone: string, code: string, keepSignedIn: boolean): Promise<TokenPair> {
  return api<TokenPair>('/auth/otp/verify', { method: 'POST', body: { phone, code }, transport: cookieTransport(keepSignedIn) })
}

/** The signed-in user behind the current access token. */
export function getCurrentUser(): Promise<User> {
  return api<User>('/users/me')
}

export interface VerifyInput {
  phone: string
  code: string
  keepSignedIn: boolean
}

/** Verify, gate on role=admin, start the session: success yields the user to put into session state. */
export async function verifyAdminOtp({ phone, code, keepSignedIn }: VerifyInput): Promise<User> {
  const pair = await verifyOtp(phone, code, keepSignedIn)
  if (!pair.user.roles.includes('admin')) {
    // The backend already set a refresh cookie for this account: revoke it (best effort; the sign-in is refused either way).
    await endSession()
    throw new ApiError('not_admin', NOT_ADMIN, 403)
  }
  session.start(pair, keepSignedIn)
  return pair.user
}

/** POST /auth/otp/request as a mutation: the screen reads isPending/error, not hand-rolled state. */
export function useRequestOtp() {
  return useMutation({ mutationFn: requestOtp })
}

/** POST /auth/otp/verify (+ admin gate + in-memory access token); onSuccess hands the user to AuthProvider. */
export function useVerifyOtp() {
  return useMutation({ mutationFn: verifyAdminOtp })
}
