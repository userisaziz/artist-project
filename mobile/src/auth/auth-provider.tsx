import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { AccountDetails, ChosenRole, TokenPair, User } from '../core/api/types';
import { configureSessionBridge, transport } from '../core/api/client';
import * as authApi from '../api/endpoints/auth';
import * as accountApi from '../api/endpoints/account';
import { sessionStore } from './session-store';
import { MockTransport } from '../core/api/mock/transport';
import { queryClient } from '../core/api/query-client';

type AuthStatus = 'restoring' | 'unauthenticated' | 'authenticated';

interface AuthContextValue {
  status: AuthStatus;
  user: User | null;
  requestOtp: (phone: string) => Promise<void>;
  verifyOtp: (phone: string, code: string) => Promise<void>;
  signOut: () => Promise<void>;
  /** Sign-up and Choose role: each saves server-side, then swaps in the returned user so the gate re-routes. */
  completeSignup: (details: AccountDetails) => Promise<void>;
  chooseRole: (role: ChosenRole) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('restoring');
  const [user, setUser] = useState<User | null>(null);
  const accessTokenRef = useRef<string | null>(null);
  const pendingRefresh = useRef<Promise<TokenPair | null> | null>(null);

  const applyPair = useCallback(async (pair: TokenPair) => {
    await sessionStore.save(pair); // persist first: a failed save rejects without leaving an unpersisted session
    accessTokenRef.current = pair.access_token;
    setUser(pair.user);
    setStatus('authenticated');
  }, []);

  const doRefresh = useCallback(async (): Promise<TokenPair | null> => {
    try {
      const stored = await sessionStore.getRefreshToken();
      if (!stored) return null;
      const pair = await authApi.refreshSession(stored);
      await applyPair(pair);
      return pair;
    } catch {
      // Refresh failure IS the logout signal: no silent half-authenticated state.
      accessTokenRef.current = null;
      setUser(null);
      setStatus('unauthenticated');
      queryClient.clear();
      // Deliberate swallow: storage may be what just failed; state is already unauthenticated, so a failed clear changes nothing.
      await sessionStore.clear().catch(() => {});
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
    })().catch(() => setStatus('unauthenticated')); // SecureStore read failed on cold start → login, never stuck on splash
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
      queryClient.clear(); // no cached profile survives into the next account
      await sessionStore.clear();
    },
    completeSignup: async (details) => { setUser(await accountApi.updateMe(details)); },
    chooseRole: async (role) => { setUser(await accountApi.chooseRole(role)); },
  }), [status, user, applyPair]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

/**
 * OTP screen helper: surface the generated code in mock mode (mirrors backend console-SMS). No-op against real transport or outside __DEV__.
 * Replays the latest code first: the first OTP is generated on the Login screen, before this screen mounts.
 */
export function useMockOtpListener(cb: (phone: string, code: string) => void) {
  useEffect(() => {
    if (__DEV__ && transport instanceof MockTransport) {
      const mock = transport; // narrowing doesn't survive into the cleanup closure
      if (mock.lastOtp) cb(mock.lastOtp.phone, mock.lastOtp.code);
      mock.onOtpGenerated = cb;
      return () => { mock.onOtpGenerated = undefined; };
    }
    return undefined;
  }, [cb]);
}
