// Query keys read or written by more than one feature live here so no feature imports another's hooks.
// Keys private to one feature stay in that feature's hooks file.

/** The signed-in artist's own profile (GET /artists/me). Every artist write returns it whole. */
export const ARTIST_PROFILE_KEY = ['artist', 'me'] as const;
