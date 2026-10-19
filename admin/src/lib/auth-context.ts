import { createContext, useContext } from 'react'
import type { User } from './types'

// The session as screens see it. The provider that drives it lives in app/providers/auth-provider.tsx;
// this shared module only holds the context + hook, so features can read the session without
// importing from app/ or from the auth feature.

/**
 * restoring: the one load-time refresh is in flight. unavailable: it couldn't reach the server
 * (offline, 5xx, 429), so the session is kept and the visitor can retry. signedOut / signedIn: settled.
 */
export type AuthStatus = 'restoring' | 'unavailable' | 'signedOut' | 'signedIn'

export interface AuthValue {
  status: AuthStatus
  user: User | null
  /** Applies a verified user to session state; the api layer has already checked the role and kept the access token. */
  signIn: (user: User) => void
  /** Ends the session on the server (best effort) and locally (always). */
  signOut: () => void
  /** From 'unavailable': try the load-time refresh again. */
  retryRestore: () => void
}

export const AuthContext = createContext<AuthValue | null>(null)

export function useAuth(): AuthValue {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used inside <AuthProvider>')
  return value
}
