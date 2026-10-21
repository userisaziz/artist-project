/** GET /saved/ids: every saved id of each kind (backend app/saved). */
export interface SavedIds {
  posts: string[];
  artists: string[];
  products: string[];
}

export type SavedKind = 'post' | 'artist' | 'product';

export const SAVED_LIST: Record<SavedKind, keyof SavedIds> = { post: 'posts', artist: 'artists', product: 'products' };
