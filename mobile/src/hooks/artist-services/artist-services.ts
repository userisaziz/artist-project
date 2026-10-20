import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { UseMutationResult } from '@tanstack/react-query';
import * as servicesApi from '../../api/artist-services/artist-services';
import type { CustomServiceInput, CustomServicePatch } from '../../types/artist-services/artist-services';
import { ARTIST_PROFILE_KEY } from '../../core/api/query-keys';

// Custom-service writes (My services). Each returns the whole artist profile, which replaces the cached one.

type Profile = Awaited<ReturnType<typeof servicesApi.addCustomService>>;

function useCustomServiceMutation<TVars>(name: string, write: (vars: TVars) => Promise<Profile>): UseMutationResult<Profile, Error, TVars> {
  const client = useQueryClient();
  return useMutation({
    mutationKey: ['artist-services', name],
    mutationFn: write,
    onSuccess: async (profile) => {
      // Prefix match: the profile is cached per user id, and sign-out clears the cache, so only this user's entry exists.
      await client.cancelQueries({ queryKey: ARTIST_PROFILE_KEY }); // an in-flight GET must not land on top of this write
      client.setQueriesData({ queryKey: ARTIST_PROFILE_KEY }, profile);
    },
  });
}

/** POST /artists/me/custom-services — waits for admin review. */
export function useAddCustomService(): UseMutationResult<Profile, Error, CustomServiceInput> {
  return useCustomServiceMutation('add', (input: CustomServiceInput) => servicesApi.addCustomService(input));
}

/** PATCH /artists/me/custom-services/{id} — any edit sends the service back to review. */
export function useUpdateCustomService(): UseMutationResult<Profile, Error, { id: string; input: CustomServicePatch }> {
  return useCustomServiceMutation('update', ({ id, input }: { id: string; input: CustomServicePatch }) => servicesApi.updateCustomService(id, input));
}

/** DELETE /artists/me/custom-services/{id}. */
export function useDeleteCustomService(): UseMutationResult<Profile, Error, string> {
  return useCustomServiceMutation('delete', (id: string) => servicesApi.deleteCustomService(id));
}
