import { request } from '../../core/api/client';
import { withQuery } from '../../core/api/query-string';
import type { Page } from '../../core/api/types';
import type { Post } from '../../types/feed/feed';
import type { ArtistCard } from '../../types/directory/directory';
import type { Product } from '../../types/shop/shop';
import type { SavedIds, SavedKind } from '../../types/saved/saved';

// The customer's Saved posts, artists and products (backend app/saved). Saving and unsaving are idempotent.
export function getSavedIds() {
  return request<SavedIds>('/saved/ids', undefined, { auth: true, method: 'GET' });
}
export function save(kind: SavedKind, id: string) {
  return request<void>(`/saved/${kind}/${encodeURIComponent(id)}`, undefined, { auth: true, method: 'PUT' });
}
export function unsave(kind: SavedKind, id: string) {
  return request<void>(`/saved/${kind}/${encodeURIComponent(id)}`, undefined, { auth: true, method: 'DELETE' });
}
export function listSavedPosts(cursor?: string | null) {
  return request<Page<Post>>(withQuery('/saved/posts', { cursor }), undefined, { auth: true, method: 'GET' });
}
export function listSavedArtists(cursor?: string | null) {
  return request<Page<ArtistCard>>(withQuery('/saved/artists', { cursor }), undefined, { auth: true, method: 'GET' });
}
export function listSavedProducts(cursor?: string | null) {
  return request<Page<Product>>(withQuery('/saved/products', { cursor }), undefined, { auth: true, method: 'GET' });
}
