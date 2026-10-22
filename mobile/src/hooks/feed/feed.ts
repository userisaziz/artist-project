import { useInfiniteQuery, useMutation, useQuery, useQueryClient, type InfiniteData } from '@tanstack/react-query';
import type { Page } from '../../core/api/types';
import * as feedApi from '../../api/feed/feed';
import { useAuth } from '../../context/auth/auth-provider';
import { patchPosts } from '../../utils/feed/article';
import type { FeedTab, Post, PostInput, ReportReason } from '../../types/feed/feed';

// Keyed by user id, so another account on the device never sees cached likes and follows.
export const feedKeys = {
  all: ['feed'] as const,
  lists: (userId: string | undefined) => ['feed', userId, 'list'] as const,
  list: (userId: string | undefined, tab: FeedTab) => ['feed', userId, 'list', tab] as const,
  /** Under the tab's key, so anything that refreshes a tab refreshes its searches too. */
  search: (userId: string | undefined, tab: FeedTab, q: string) => ['feed', userId, 'list', tab, 'search', q] as const,
  post: (userId: string | undefined, id: string) => ['feed', userId, 'post', id] as const,
  mine: (userId: string | undefined) => ['feed', userId, 'mine'] as const,
  followers: (userId: string | undefined) => ['feed', userId, 'followers'] as const,
  /** Outside `lists`: a plain page, not an infinite list, so the list patchers never touch it. */
  artistPosts: (userId: string | undefined, artistId: string) => ['feed', userId, 'artist', artistId, 'posts'] as const,
  follow: (userId: string | undefined, artistId: string) => ['feed', userId, 'artist', artistId, 'follow'] as const,
};

export function useFeed(tab: FeedTab, q = '') {
  const { user } = useAuth();
  return useInfiniteQuery({
    queryKey: q ? feedKeys.search(user?.id, tab, q) : feedKeys.list(user?.id, tab),
    queryFn: ({ pageParam }) => feedApi.getFeed(tab, pageParam, q),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.next_cursor,
    enabled: !!user,
  });
}

export function usePost(id: string) {
  const { user } = useAuth();
  return useQuery({ queryKey: feedKeys.post(user?.id, id), queryFn: () => feedApi.getPost(id), enabled: !!user && !!id });
}

/** Applies `patch` to matching posts in every cached feed list and open post. */
function usePatchPosts() {
  const { user } = useAuth();
  const client = useQueryClient();
  return (match: (p: Post) => boolean, patch: Partial<Post>) => {
    const patchPages = (data: InfiniteData<Page<Post>> | undefined) => patchPosts(data, match, patch);
    client.setQueriesData({ queryKey: feedKeys.lists(user?.id) }, patchPages);
    client.setQueriesData({ queryKey: feedKeys.mine(user?.id) }, patchPages);
    client.setQueriesData({ queryKey: ['feed', user?.id, 'post'] }, (post: Post | undefined) => (post && match(post) ? { ...post, ...patch } : post));
  };
}

/** Likes or unlikes `post` (whichever it isn't), then shows the server's count everywhere it's cached. */
export function useToggleLike() {
  const patch = usePatchPosts();
  return useMutation({
    mutationFn: (post: Post) => feedApi.setLike(post.id, !post.liked),
    onSuccess: (result, post) => patch((p) => p.id === post.id, { liked: result.liked, like_count: result.like_count }),
  });
}

/** An artist's newest posts for their storefront. Customers only: `enabled` is false on the artist's own preview. */
export function useArtistPosts(artistId: string, limit: number, enabled: boolean) {
  const { user } = useAuth();
  return useQuery({
    queryKey: feedKeys.artistPosts(user?.id, artistId),
    queryFn: () => feedApi.getArtistPosts(artistId, limit),
    select: (page) => page.items,
    enabled: enabled && !!user && !!artistId,
  });
}

/** Whether the signed-in customer follows `artistId`; useToggleFollow keeps it current. */
export function useFollowState(artistId: string, enabled: boolean) {
  const { user } = useAuth();
  return useQuery({
    queryKey: feedKeys.follow(user?.id, artistId),
    queryFn: () => feedApi.getFollow(artistId),
    select: (state) => state.following,
    enabled: enabled && !!user && !!artistId,
  });
}

export function useToggleFollow() {
  const { user } = useAuth();
  const client = useQueryClient();
  const patch = usePatchPosts();
  return useMutation({
    mutationFn: ({ artistId, following }: { artistId: string; following: boolean }) => feedApi.setFollow(artistId, following),
    onSuccess: (result, { artistId }) => {
      patch((p) => p.artist.id === artistId, { following: result.following });
      client.setQueryData(feedKeys.follow(user?.id, artistId), result);
      void client.invalidateQueries({ queryKey: feedKeys.list(user?.id, 'following') }); // in the background
    },
  });
}

export function useMyPosts() {
  const { user } = useAuth();
  return useInfiniteQuery({
    queryKey: feedKeys.mine(user?.id),
    queryFn: ({ pageParam }) => feedApi.listMyPosts(pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.next_cursor,
    enabled: !!user,
  });
}

export function useCreatePost() {
  const { user } = useAuth();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: PostInput) => feedApi.createPost(input),
    onSuccess: () => Promise.all([
      client.invalidateQueries({ queryKey: feedKeys.mine(user?.id) }),
      client.invalidateQueries({ queryKey: feedKeys.lists(user?.id) }),
    ]),
  });
}

export function useDeletePost() {
  const { user } = useAuth();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => feedApi.deletePost(id),
    onSuccess: (_, id) => {
      client.removeQueries({ queryKey: feedKeys.post(user?.id, id) });
      return Promise.all([
        client.invalidateQueries({ queryKey: feedKeys.mine(user?.id) }),
        client.invalidateQueries({ queryKey: feedKeys.lists(user?.id) }),
      ]);
    },
  });
}

export function useReportPost() {
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: ReportReason }) => feedApi.reportPost(id, reason),
  });
}

/** Me → Followers; the first page also carries the total for the Me row. */
export function useMyFollowers() {
  const { user } = useAuth();
  return useInfiniteQuery({
    queryKey: feedKeys.followers(user?.id),
    queryFn: ({ pageParam }) => feedApi.listMyFollowers(pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.next_cursor,
    enabled: !!user,
  });
}
