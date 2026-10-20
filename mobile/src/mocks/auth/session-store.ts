import type { sessionStore } from '../../utils/auth/session-store';

type SessionStore = typeof sessionStore;

/** In-memory stand-in for the SecureStore-backed session store; `refreshToken` is inspectable in tests. */
export interface MemorySessionStore extends SessionStore {
  refreshToken: string | null;
  saves: string[];
}

export function createMemorySessionStore(): MemorySessionStore {
  const store: MemorySessionStore = {
    refreshToken: null,
    saves: [],
    async save(pair) {
      store.refreshToken = pair.refresh_token;
      store.saves.push(pair.refresh_token);
    },
    async getRefreshToken() {
      return store.refreshToken;
    },
    async clear() {
      store.refreshToken = null;
    },
  };
  return store;
}
