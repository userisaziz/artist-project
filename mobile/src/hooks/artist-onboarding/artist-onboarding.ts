import { useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { UseMutationResult } from '@tanstack/react-query';
import * as artistApi from '../../api/artist-onboarding/artist-onboarding';
import { uploadImage } from '../../api/artist-onboarding/upload';
import type { PickedImage } from '../../api/artist-onboarding/upload';
import type { ArtistProfile, LocationInput, PhotoInput, ProfileInput, ServiceInput, UploadPurpose } from '../../types/artist-onboarding/artist-onboarding';
import { useAuth } from '../../context/auth/auth-provider';
import { ARTIST_PROFILE_KEY } from '../../core/api/query-keys';

// Keyed by user id, so a different account never sees a cached profile.
const artistKey = (userId: string | undefined) => [...ARTIST_PROFILE_KEY, userId] as const;

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

/** A write that returns the whole profile, as a mutation: the result replaces the cached profile on success. */
function useProfileMutation<TVars>(name: string, write: (vars: TVars) => Promise<ArtistProfile>): UseMutationResult<ArtistProfile, Error, TVars> {
  const { user } = useAuth();
  const client = useQueryClient();
  return useMutation({
    mutationKey: ['artist-onboarding', name],
    mutationFn: write,
    onSuccess: async (profile) => {
      await client.cancelQueries({ queryKey: artistKey(user?.id) }); // an in-flight GET must not land on top of this write
      client.setQueryData(artistKey(user?.id), profile);
    },
  });
}

/** POST /artists/me/reopen — Me → Edit profile on an approved profile. */
export function useReopenProfile(): UseMutationResult<ArtistProfile, Error, void> {
  return useProfileMutation('reopen', () => artistApi.reopenProfile());
}

/** PUT /artists/me/profile — onboarding step 1. */
export function useSaveProfile(): UseMutationResult<ArtistProfile, Error, ProfileInput> {
  return useProfileMutation('save-profile', artistApi.saveProfile);
}

/** PUT /artists/me/location — onboarding step 2. */
export function useSaveLocation(): UseMutationResult<ArtistProfile, Error, LocationInput> {
  return useProfileMutation('save-location', artistApi.saveLocation);
}

/** POST /artists/me/services — a service from the admin's list with the artist's price and duration. */
export function useAddService(): UseMutationResult<ArtistProfile, Error, ServiceInput> {
  return useProfileMutation('add-service', artistApi.addService);
}

/** DELETE /artists/me/services/{id}. */
export function useDeleteService(): UseMutationResult<ArtistProfile, Error, string> {
  return useProfileMutation('delete-service', artistApi.deleteService);
}

/** Shrinks, signs and uploads one photo; resolves with the storage key for the next profile write. */
export function useUploadPhoto(): UseMutationResult<PhotoInput, Error, { image: PickedImage; purpose: UploadPurpose }> {
  return useMutation({
    mutationKey: ['artist-onboarding', 'upload-photo'],
    mutationFn: ({ image, purpose }) => uploadImage(image, purpose),
  });
}
