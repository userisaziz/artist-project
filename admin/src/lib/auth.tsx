import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { api, ApiError, refreshSession, session } from './api'
import type { TokenPair, User } from './types'

type Status = 'restoring' | 'signedOut' | 'signedIn'

interface AuthValue {
  status: Status
  user: User | null
  requestCode: (phone: string) => Promise<void>
  verifyCode: (phone: string, code: string, keepSignedIn: boolean) => Promise<void>
  signOut: () => void
}

const AuthContext = createContext<AuthValue | null>(null)

export const NOT_ADMIN = "This account isn't an admin."

/** Phone + OTP sign-in (the same /auth endpoints as the mobile app), limited to role=admin. */
export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [status, setStatus] = useState<Status>(() => (session.hasRefreshToken() ? 'restoring' : 'signedOut'))
  const [user, setUser] = useState<User | null>(null)

  const signOut = useCallback(() => {
    session.clear()
    queryClient.clear()
    setUser(null)
    setStatus('signedOut')
  }, [queryClient])

  useEffect(() => {
    session.onExpired(signOut)
    return () => session.onExpired(null)
  }, [signOut])

  // On load, a stored refresh token silently restores the session.
  useEffect(() => {
    if (status !== 'restoring') return
    let cancelled = false
    ;(async () => {
      const me = (await refreshSession()) ? await api<User>('/users/me') : null
      if (cancelled) return
      if (me?.roles.includes('admin')) {
        setUser(me)
        setStatus('signedIn')
      } else {
        signOut()
      }
    })().catch(() => {
      if (!cancelled) signOut()
    })
    return () => {
      cancelled = true
    }
  }, [status, signOut])

  const requestCode = useCallback(async (phone: string) => {
    await api('/auth/otp/request', { method: 'POST', body: { phone } })
  }, [])

  const verifyCode = useCallback(async (phone: string, code: string, keepSignedIn: boolean) => {
    const pair = await api<TokenPair>('/auth/otp/verify', { method: 'POST', body: { phone, code } })
    if (!pair.user.roles.includes('admin')) throw new ApiError('not_admin', NOT_ADMIN, 403) // tokens are never stored
    session.store(pair, keepSignedIn)
    setUser(pair.user)
    setStatus('signedIn')
  }, [])

  const value = useMemo(() => ({ status, user, requestCode, verifyCode, signOut }), [status, user, requestCode, verifyCode, signOut])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthValue {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used inside <AuthProvider>')
  return value
}
