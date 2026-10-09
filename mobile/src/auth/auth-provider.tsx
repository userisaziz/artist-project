import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { TokenPair, User } from '../api/types';
import { configureSessionBridge, transport } from '../api/client';
import * as authApi from '../api/endpoints/auth';
import { sessionStore } from './session-store';
import { MockTransport } from '../api/mock/transport';

type AuthStatus = 'restoring' | 'unauthenticated' | 'authenticated';

interface AuthContextValue {
  status: AuthStatus;
  user: User | null;
  requestOtp: (phone: string) => Promise<void>;
  verifyOtp: (phone: string, code: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('restoring');
  const [user, setUser] = useState<User | null>(null);
  const accessTokenRef = useRef<string | null>(null);
  const pendingRefresh = useRef<Promise<TokenPair | null> | null>(null);

  const applyPair = useCallback(async (pair: TokenPair) => {
    accessTokenRef.current = pair.access_token;
    setUser(pair.user);
    setStatus('authenticated');
    await sessionStore.save(pair);
  }, []);

  const doRefresh = useCallback(async (): Promise<TokenPair | null> => {
    const stored = await sessionStore.getRefreshToken();
    if (!stored) return null;
    try {
      const pair = await authApi.refreshSession(stored);
      await applyPair(pair);
      return pair;
    } catch {
      // Refresh failure IS the logout signal: no silent half-authenticated state.
      accessTokenRef.current = null;
      setUser(null);
      setStatus('unauthenticated');
      await sessionStore.clear();
      return null;
    }
  }, [applyPair]);

  const refreshSession = useCallback(async () => {
    // Dedupe: concurrent 401s share one refresh instead of stampeding rotation (a rotated token dies on second use).
    if (!pendingRefresh.current) pendingRefresh.current = doRefresh().finally(() => { pendingRefresh.current = null; });
    return pendingRefresh.current;
  }, [doRefresh]);

  useEffect(() => {
    configureSessionBridge({ getAccessToken: () => accessTokenRef.current, refreshSession });
    (async () => {
      const stored = await sessionStore.getRefreshToken();
      if (!stored) { setStatus('unauthenticated'); return; }
      await refreshSession(); // success → authenticated (via applyPair); failure → unauthenticated (via catch)
    })();
    return () => configureSessionBridge(null);
  }, [refreshSession]);

  const value = useMemo<AuthContextValue>(() => ({
    status,
    user,
    requestOtp: (phone) => authApi.requestOtp(phone),
    verifyOtp: async (phone, code) => { await applyPair(await authApi.verifyOtp(phone, code)); },
    signOut: async () => {
      accessTokenRef.current = null;
      setUser(null);
      setStatus('unauthenticated');
      await sessionStore.clear();
    },
  }), [status, user, applyPair]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

/**
 * OTP screen helper: surface the generated code in mock mode (mirrors backend console-SMS). No-op against real transport.
 * Replays the latest code first: the first OTP is generated on the Login screen, before this screen mounts.
 */
export function useMockOtpListener(cb: (phone: string, code: string) => void) {
  useEffect(() => {
    if (transport instanceof MockTransport) {
      const mock = transport; // narrowing doesn't survive into the cleanup closure
      if (mock.lastOtp) cb(mock.lastOtp.phone, mock.lastOtp.code);
      mock.onOtpGenerated = cb;
      return () => { mock.onOtpGenerated = undefined; };
    }
    return undefined;
  }, [cb]);
}
