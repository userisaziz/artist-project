import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { AccountDetails } from '../../types/account/account';
import type { ChosenRole, TokenPair, User } from '../../types/auth/auth';
import { configureSessionBridge } from '../../core/api/client';
import { ApiError } from '../../core/api/types';
import * as authApi from '../../api/auth/auth';
import * as accountApi from '../../api/account/account';
import { sessionStore } from '../../utils/auth/session-store';
import { queryClient } from '../../core/api/query-client';

/** `unavailable`: a stored session could not be checked (offline, timeout, 5xx, 429); the token is kept for Retry. */
export type AuthStatus = 'restoring' | 'unavailable' | 'unauthenticated' | 'authenticated';

export interface AuthContextValue {
  status: AuthStatus;
  user: User | null;
  requestOtp: (phone: string) => Promise<void>;
  verifyOtp: (phone: string, code: string) => Promise<void>;
  signOut: () => Promise<void>;
  /** Re-runs the cold-start restore after `unavailable`. */
  retryRestore: () => Promise<void>;
  /** Sign-up and Choose role: each saves server-side, then swaps in the returned user so the gate re-routes. */
  completeSignup: (details: AccountDetails) => Promise<void>;
  chooseRole: (role: ChosenRole) => Promise<void>;
}

type RefreshResult =
  | { kind: 'refreshed'; pair: TokenPair }
  | { kind: 'signed-out' }  // nothing stored, or the server rejected the token (401/403)
  | { kind: 'transient' }   // network, timeout, 5xx, 429, storage hiccup: the stored token is kept
  | { kind: 'superseded' }; // signOut ran while this was in flight: its result is discarded

/** Only an explicit server rejection ends the session; anything else may succeed on the next try. */
const isSessionRejected = (e: unknown): boolean => e instanceof ApiError && (e.status === 401 || e.status === 403);

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('restoring');
  const [user, setUser] = useState<User | null>(null);
  const accessTokenRef = useRef<string | null>(null);
  const pendingRefresh = useRef<Promise<RefreshResult> | null>(null);
  // Bumped on every sign-out. Async work captures it first and drops its result if it changed meanwhile,
  // so a refresh or OTP verify that lands after sign-out can never sign the user back in.
  const epochRef = useRef(0);

  /** Persist, then publish — unless a sign-out happened meanwhile. Returns whether the pair was applied. */
  const applyPair = useCallback(async (pair: TokenPair, epoch: number): Promise<boolean> => {
    if (epochRef.current !== epoch) return false; // signed out while the network call was in flight
    await sessionStore.save(pair); // persist first: a failed save rejects without leaving an unpersisted session
    if (epochRef.current !== epoch) {
      await sessionStore.clear(); // sign-out's clear may have run before this save landed: undo it
      return false;
    }
    accessTokenRef.current = pair.access_token;
    setUser(pair.user);
    setStatus('authenticated');
    return true;
  }, []);

  const resetLocalSession = useCallback(() => {
    epochRef.current += 1;
    accessTokenRef.current = null;
    setUser(null);
    setStatus('unauthenticated');
    queryClient.clear(); // no cached profile survives into the next account
  }, []);

  const signOut = useCallback(async () => {
    resetLocalSession();
    let stored: string | null;
    try {
      stored = await sessionStore.getRefreshToken();
    } finally {
      await sessionStore.clear(); // forget the token before the network call: a killed app must not restore it
    }
    if (!stored) return;
    try {
      await authApi.logout(stored);
    } catch {
      // Best effort. The device has already forgotten the token, so the user is signed out here; the server-side
      // session just lives until its refresh TTL. Blocking sign-out on the network would trap offline users.
    }
  }, [resetLocalSession]);

  const runRefresh = useCallback(async (): Promise<RefreshResult> => {
    const epoch = epochRef.current;
    try {
      const stored = await sessionStore.getRefreshToken();
      if (!stored) {
        resetLocalSession();
        return { kind: 'signed-out' };
      }
      const pair = await authApi.refreshSession(stored);
      if (!(await applyPair(pair, epoch))) return { kind: 'superseded' };
      return { kind: 'refreshed', pair };
    } catch (e) {
      if (epochRef.current !== epoch) return { kind: 'superseded' };
      if (!isSessionRejected(e)) return { kind: 'transient' };
      resetLocalSession();
      // The server already rejected this token, so if deleting it fails the next restore gets 401 again and retries
      // the delete; the session is over either way, and the bridge contract forbids throwing here.
      await sessionStore.clear().catch(() => undefined);
      return { kind: 'signed-out' };
    }
  }, [applyPair, resetLocalSession]);

  // Dedupe: concurrent 401s share one refresh instead of stampeding rotation (a rotated token dies on second use).
  const sharedRefresh = useCallback((): Promise<RefreshResult> => {
    if (!pendingRefresh.current) pendingRefresh.current = runRefresh().finally(() => { pendingRefresh.current = null; });
    return pendingRefresh.current;
  }, [runRefresh]);

  const restore = useCallback(async () => {
    const result = await sharedRefresh();
    // refreshed / signed-out / superseded have already set their status; only a transient failure needs a screen.
    if (result.kind === 'transient') setStatus('unavailable');
  }, [sharedRefresh]);

  useEffect(() => {
    configureSessionBridge({
      getAccessToken: () => accessTokenRef.current,
      // Mid-session a transient failure returns null without signing out: the original request error surfaces.
      refreshSession: async () => {
        const result = await sharedRefresh();
        return result.kind === 'refreshed' ? result.pair : null;
      },
      onUnauthorized: () => {
        signOut().catch(() => {
          // Local state is already signed out (resetLocalSession runs first); only the token delete can fail here,
          // and that token was just rejected, so the next restore's 401 clears it.
        });
      },
    });
    void restore();
    return () => configureSessionBridge(null);
  }, [sharedRefresh, signOut, restore]);

  const value = useMemo<AuthContextValue>(() => ({
    status,
    user,
    requestOtp: (phone) => authApi.requestOtp(phone),
    verifyOtp: async (phone, code) => {
      const epoch = epochRef.current;
      const pair = await authApi.verifyOtp(phone, code);
      await applyPair(pair, epoch); // a sign-out meanwhile wins: applyPair drops the pair
    },
    signOut,
    retryRestore: restore,
    completeSignup: async (details) => { setUser(await accountApi.updateMe(details)); },
    chooseRole: async (role) => { setUser(await accountApi.chooseRole(role)); },
  }), [status, user, applyPair, signOut, restore]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
