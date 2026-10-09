import * as SecureStore from 'expo-secure-store';
import type { TokenPair } from '../api/types';

const ACCESS_KEY = 'ac.access_token';
const REFRESH_KEY = 'ac.refresh_token';

export const sessionStore = {
  async save(pair: TokenPair): Promise<void> {
    await SecureStore.setItemAsync(ACCESS_KEY, pair.access_token);
    await SecureStore.setItemAsync(REFRESH_KEY, pair.refresh_token);
  },
  async getRefreshToken(): Promise<string | null> {
    return SecureStore.getItemAsync(REFRESH_KEY);
  },
  async clear(): Promise<void> {
    await SecureStore.deleteItemAsync(ACCESS_KEY);
    await SecureStore.deleteItemAsync(REFRESH_KEY);
  },
};
