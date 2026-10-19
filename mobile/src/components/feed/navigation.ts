/** Where feed screens send people; the route files supply these, so components never hard-code paths. */
export interface FeedNavigation {
  openArtist: (artistId: string) => void;
  openPost: (postId: string) => void;
  book: (artistId: string, serviceId: string) => void;
}
