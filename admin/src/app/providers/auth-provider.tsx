import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { getCurrentUser } from '@/features/auth/api'
import { ApiError, endSession, refreshSession, session } from '@/lib/api'
import { AuthContext, type AuthStatus } from '@/lib/auth-context'
import type { User } from '@/lib/types'

type Restored = { kind: 'signedIn'; user: User } | { kind: 'signedOut' } | { kind: 'notAdmin' } | { kind: 'unavailable' }

/** The JS can't see the httpOnly refresh cookie, so every load tries one refresh to find out. */
async function restoreSession(): Promise<Restored> {
  const refreshed = await refreshSession()
  if (refreshed === 'expired') return { kind: 'signedOut' }
  if (refreshed === 'unavailable') return { kind: 'unavailable' }
  try {
    const me = await getCurrentUser()
    return me.roles.includes('admin') ? { kind: 'signedIn', user: me } : { kind: 'notAdmin' }
  } catch (e) {
    if (e instanceof ApiError && (e.status === 401 || e.status === 403)) return { kind: 'signedOut' }
    return { kind: 'unavailable' }
  }
}

/** Phone + OTP sign-in (the same /auth endpoints as the mobile app), limited to role=admin. */
export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [status, setStatus] = useState<AuthStatus>('restoring')
  const [user, setUser] = useState<User | null>(null)

  const signIn = useCallback((next: User) => {
    setUser(next)
    setStatus('signedIn')
  }, [])

  const clearLocally = useCallback(() => {
    session.clear()
    queryClient.clear()
    setUser(null)
    setStatus('signedOut')
  }, [queryClient])

  const signOut = useCallback(() => {
    // Best effort by design: the result is deliberately not awaited or surfaced. If the server can't be
    // reached, the admin is still signed out here, and the refresh cookie simply expires server-side.
    void endSession()
    clearLocally()
  }, [clearLocally])

  const retryRestore = useCallback(() => setStatus('restoring'), [])

  // A refresh refused mid-session: the cookie is already invalid, so only local state needs clearing.
  useEffect(() => {
    session.onExpired(clearLocally)
    return () => session.onExpired(null)
  }, [clearLocally])

  useEffect(() => {
    if (status !== 'restoring') return
    let cancelled = false
    session.purgeLegacyStorage()
    void restoreSession().then((restored) => {
      if (cancelled) return
      if (restored.kind === 'signedIn') signIn(restored.user)
      else if (restored.kind === 'notAdmin') signOut() // revoke the non-admin's cookie too
      else if (restored.kind === 'unavailable') setStatus('unavailable')
      else clearLocally()
    })
    return () => {
      cancelled = true
    }
  }, [status, signIn, signOut, clearLocally])

  const value = useMemo(() => ({ status, user, signIn, signOut, retryRestore }), [status, user, signIn, signOut, retryRestore])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
