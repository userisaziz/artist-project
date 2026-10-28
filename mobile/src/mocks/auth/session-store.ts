import type { sessionStore } from '../../utils/auth/session-store';
import type { User } from '../../types/auth/auth';

type SessionStore = typeof sessionStore;

/** In-memory stand-in for the SecureStore-backed session store; `refreshToken` and `user` are inspectable in tests. */
export interface MemorySessionStore extends SessionStore {
  refreshToken: string | null;
  user: User | null;
  saves: string[];
}

export function createMemorySessionStore(): MemorySessionStore {
  const store: MemorySessionStore = {
    refreshToken: null,
    user: null,
    saves: [],
    async save(pair) {
      store.refreshToken = pair.refresh_token;
      store.saves.push(pair.refresh_token);
    },
    async getRefreshToken() {
      return store.refreshToken;
    },
    async saveUser(user) {
      store.user = user;
    },
    async getUser() {
      return store.user;
    },
    async clear() {
      store.refreshToken = null;
      store.user = null;
    },
  };
  return store;
}
