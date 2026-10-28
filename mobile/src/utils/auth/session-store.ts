import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import type { TokenPair, User } from '../../types/auth/auth';

// Only the refresh token is persisted; the access token stays in memory (AuthProvider).
// LEGACY_ACCESS_KEY is still cleared on sign-out: builds before 2026-10-18 stored it.
// USER_KEY holds the last profile (no secrets), so a cold start can open the app before the refresh answers.
const LEGACY_ACCESS_KEY = 'ac.access_token';
const REFRESH_KEY = 'ac.refresh_token';
const USER_KEY = 'ac.user';

/** Our own earlier write, but storage can hold an older shape: anything that isn't a usable profile reads as none. */
function parseUser(raw: string | null): User | null {
  if (!raw) return null;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null; // unreadable: the cold start falls back to waiting for the refresh
  }
  if (typeof value !== 'object' || value === null) return null;
  const u = value as Partial<User>;
  const usable = typeof u.id === 'string' && typeof u.phone === 'string' && Array.isArray(u.roles) && typeof u.is_onboarded === 'boolean';
  return usable ? (value as User) : null;
}

interface TokenStorage {
  setItemAsync: (key: string, value: string) => Promise<void>;
  getItemAsync: (key: string) => Promise<string | null>;
  deleteItemAsync: (key: string) => Promise<void>;
}

// expo-secure-store has no web implementation (every call throws), so the web dev preview keeps tokens in
// localStorage. That is readable by any script on the page, so a production web build refuses to start.
function webDevStorage(): TokenStorage {
  if (!__DEV__) {
    throw new Error('Web builds are a development preview only: refusing to keep auth tokens in localStorage in production.');
  }
  return {
    setItemAsync: async (k, v) => localStorage.setItem(k, v),
    getItemAsync: async (k) => localStorage.getItem(k),
    deleteItemAsync: async (k) => localStorage.removeItem(k),
  };
}

const store: TokenStorage = Platform.OS === 'web' ? webDevStorage() : SecureStore;

export const sessionStore = {
  async save(pair: TokenPair): Promise<void> {
    await store.setItemAsync(REFRESH_KEY, pair.refresh_token);
  },
  async getRefreshToken(): Promise<string | null> {
    return store.getItemAsync(REFRESH_KEY);
  },
  async saveUser(user: User): Promise<void> {
    await store.setItemAsync(USER_KEY, JSON.stringify(user));
  },
  async getUser(): Promise<User | null> {
    return parseUser(await store.getItemAsync(USER_KEY));
  },
  async clear(): Promise<void> {
    await store.deleteItemAsync(LEGACY_ACCESS_KEY);
    await store.deleteItemAsync(REFRESH_KEY);
    await store.deleteItemAsync(USER_KEY);
  },
};
