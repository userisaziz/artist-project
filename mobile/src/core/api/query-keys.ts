// Query keys read or written by more than one feature live here so no feature imports another's hooks.
// Keys private to one feature stay in that feature's hooks file.

/** The signed-in artist's own profile (GET /artists/me). Every artist write returns it whole. */
export const ARTIST_PROFILE_KEY = ['artist', 'me'] as const;

/** The public catalog: the category tree (GET /categories) and the operating cities (GET /cities). */
export const CATEGORIES_KEY = ['catalog', 'categories'] as const;
export const CITIES_KEY = ['catalog', 'cities'] as const;

/** The areas of one city (GET /areas). The city is part of the key, so each city keeps its own list. */
export const areasKey = (city: string | null) => ['catalog', 'areas', city] as const;
