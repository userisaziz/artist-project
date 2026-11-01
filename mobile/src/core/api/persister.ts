import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';

/**
 * The query cache, kept on the device between runs.
 *
 * Without it a cold start has nothing to paint: every screen waits for the network and shows a
 * skeleton first. With it, the last run's answers are on disk and the first screen paints them
 * straight away, while the fresh requests run behind them.
 */
export const queryPersister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: 'art-circle-query-cache',
  // Writing on every cache change would hammer the disk; a second of batching is plenty.
  throttleTime: 1_000,
});

/**
 * Bumped when the API's response shapes change: the older cache is then thrown away instead of
 * being restored into screens that expect the new shape.
 */
export const CACHE_BUSTER = 'v1';
