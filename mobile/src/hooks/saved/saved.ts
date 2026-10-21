import { useCallback } from 'react';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as savedApi from '../../api/saved/saved';
import { useAuth } from '../../context/auth/auth-provider';
import { SAVED_LIST, type SavedIds, type SavedKind } from '../../types/saved/saved';
import type { SaveToggle } from '../../components/common/SaveButton';

// Keyed by user id, so another account on the device never sees cached saves.
export const savedKeys = {
  all: (userId: string | undefined) => ['saved', userId] as const,
  ids: (userId: string | undefined) => ['saved', userId, 'ids'] as const,
  list: (userId: string | undefined, kind: SavedKind) => ['saved', userId, 'list', kind] as const,
};

const EMPTY: SavedIds = { posts: [], artists: [], products: [] };

export function useSavedIds() {
  const { user } = useAuth();
  return useQuery({ queryKey: savedKeys.ids(user?.id), queryFn: savedApi.getSavedIds, enabled: !!user });
}

/** The bookmark for one kind: flips at once (optimistic), rolls back if the server refuses, then refreshes that Saved tab. */
export function useSaveToggle(kind: SavedKind): SaveToggle {
  const { user } = useAuth();
  const client = useQueryClient();
  const ids = useSavedIds();
  const key = savedKeys.ids(user?.id);
  const list = SAVED_LIST[kind];
  const mutation = useMutation({
    mutationFn: ({ id, on }: { id: string; on: boolean }) => (on ? savedApi.save(kind, id) : savedApi.unsave(kind, id)),
    onMutate: async ({ id, on }) => {
      await client.cancelQueries({ queryKey: key });
      const before = client.getQueryData<SavedIds>(key);
      const current = before ?? EMPTY;
      const nextIds = on ? [id, ...current[list].filter((x) => x !== id)] : current[list].filter((x) => x !== id);
      client.setQueryData<SavedIds>(key, { ...current, [list]: nextIds });
      return { before };
    },
    onError: (_error, _vars, context) => client.setQueryData(key, context?.before),
    onSettled: () => client.invalidateQueries({ queryKey: savedKeys.list(user?.id, kind) }),
  });
  const saved = ids.data?.[list];
  const isSaved = useCallback((id: string) => !!saved?.includes(id), [saved]);
  const toggle = useCallback((id: string) => mutation.mutate({ id, on: !saved?.includes(id) }), [mutation, saved]);
  return { isSaved, toggle };
}

function useSavedList<T>(kind: SavedKind, fetchPage: (cursor: string | null) => Promise<{ items: T[]; next_cursor: string | null }>) {
  const { user } = useAuth();
  return useInfiniteQuery({
    queryKey: savedKeys.list(user?.id, kind),
    queryFn: ({ pageParam }) => fetchPage(pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.next_cursor,
    enabled: !!user,
  });
}

export const useSavedPosts = () => useSavedList('post', savedApi.listSavedPosts);
export const useSavedArtists = () => useSavedList('artist', savedApi.listSavedArtists);
export const useSavedProducts = () => useSavedList('product', savedApi.listSavedProducts);
