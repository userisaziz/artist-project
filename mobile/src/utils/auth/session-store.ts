import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import type { TokenPair } from '../../types/auth/auth';

const ACCESS_KEY = 'ac.access_token';
const REFRESH_KEY = 'ac.refresh_token';

// expo-secure-store has no web implementation (every call throws), so the web preview keeps
// tokens in localStorage — fine for development, not a hardened web client.
const store = Platform.OS === 'web'
  ? {
      setItemAsync: async (k: string, v: string) => localStorage.setItem(k, v),
      getItemAsync: async (k: string) => localStorage.getItem(k),
      deleteItemAsync: async (k: string) => localStorage.removeItem(k),
    }
  : SecureStore;

export const sessionStore = {
  async save(pair: TokenPair): Promise<void> {
    await store.setItemAsync(ACCESS_KEY, pair.access_token);
    await store.setItemAsync(REFRESH_KEY, pair.refresh_token);
  },
  async getRefreshToken(): Promise<string | null> {
    return store.getItemAsync(REFRESH_KEY);
  },
  async clear(): Promise<void> {
    await store.deleteItemAsync(ACCESS_KEY);
    await store.deleteItemAsync(REFRESH_KEY);
  },
};
