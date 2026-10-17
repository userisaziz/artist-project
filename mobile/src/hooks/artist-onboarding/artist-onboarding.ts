import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as artistApi from '../../api/artist-onboarding/artist-onboarding';
import * as catalogApi from '../../api/catalog/catalog';
import type { ArtistProfile } from '../../types/artist-onboarding/artist-onboarding';
import { useAuth } from '../../context/auth/auth-provider';

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
    await client.cancelQueries({ queryKey: artistKey(user?.id) }); // an in-flight GET must not land on top of this write
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
