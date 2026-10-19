import { request } from '../../core/api/client';
import { withQuery } from '../../core/api/query-string';
import type { Page } from '../../core/api/types';
import type { FeedTab, Post, PostInput, ReportReason } from '../../types/feed/feed';

// Customer feed (backend app/feed/router.py).
export function getFeed(tab: FeedTab, cursor?: string | null) {
  return request<Page<Post>>(withQuery('/feed', { tab, cursor }), undefined, { auth: true, method: 'GET' });
}
export function getPost(id: string) {
  return request<Post>(`/feed/posts/${encodeURIComponent(id)}`, undefined, { auth: true, method: 'GET' });
}
export function setLike(id: string, liked: boolean) {
  return request<{ liked: boolean; like_count: number }>(`/feed/posts/${encodeURIComponent(id)}/like`, undefined, { auth: true, method: liked ? 'PUT' : 'DELETE' });
}
export function reportPost(id: string, reason: ReportReason) {
  return request<void>(`/feed/posts/${encodeURIComponent(id)}/report`, { reason }, { auth: true });
}
export function setFollow(artistId: string, following: boolean) {
  return request<{ following: boolean }>(`/feed/artists/${encodeURIComponent(artistId)}/follow`, undefined, { auth: true, method: following ? 'PUT' : 'DELETE' });
}

// The artist's own posts (backend app/feed/artist_router.py).
export function createPost(body: PostInput) {
  return request<Post>('/artists/me/posts', body, { auth: true });
}
export function listMyPosts(cursor?: string | null) {
  return request<Page<Post>>(withQuery('/artists/me/posts', { cursor }), undefined, { auth: true, method: 'GET' });
}
export function deletePost(id: string) {
  return request<void>(`/artists/me/posts/${encodeURIComponent(id)}`, undefined, { auth: true, method: 'DELETE' });
}
