// Root keys other features invalidate after a mutation; the owning feature builds its keys on these.
export const queryRoots = {
  overview: ['admin', 'overview'],
  artists: ['admin', 'artists'],
} as const
