import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as artistApi from '../api/endpoints/artist';
import * as catalogApi from '../api/endpoints/catalog';
import type { ArtistProfile } from '../api/types';
import { useAuth } from '../auth/auth-provider';

// Keyed by user id, so a different account never sees a cached profile.
const artistKey = (userId: string | undefined) => ['artist', 'me', userId] as const;

export function useArtistProfile() {
  const { user } = useAuth();
  return useQuery({ queryKey: artistKey(user?.id), queryFn: artistApi.getMyProfile, enabled: !!user });
}

/** Every artist write returns the whole profile; caching it re-renders the screens and re-runs the guards at once. */
export function useArtistWrite() {
  const { user } = useAuth();
  const client = useQueryClient();
  return useCallback(async (write: () => Promise<ArtistProfile>) => {
    const profile = await write();
    client.setQueryData(artistKey(user?.id), profile);
    return profile;
  }, [client, user?.id]);
}

export function useCategories() {
  return useQuery({ queryKey: ['catalog', 'categories'], queryFn: catalogApi.listCategories, staleTime: 5 * 60_000 });
}

export function useCities() {
  return useQuery({ queryKey: ['catalog', 'cities'], queryFn: catalogApi.listCities, staleTime: Infinity });
}
