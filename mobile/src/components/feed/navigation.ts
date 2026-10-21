import type { SaveToggle } from '../common/SaveButton';

/** Where feed screens send people; the route files supply these, so components never hard-code paths. */
export interface FeedNavigation {
  openArtist: (artistId: string) => void;
  openPost: (postId: string) => void;
  book: (artistId: string, serviceId: string) => void;
  /** Saving posts (customers); the artist's own views leave it out. */
  savePost?: SaveToggle;
}
