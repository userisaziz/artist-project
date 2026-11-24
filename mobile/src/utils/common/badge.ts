const BADGE_CAP = 99;

/** A tab badge for a count: hidden at 0, capped at "99+". */
export function tabBadge(count: number): string | undefined {
  if (count <= 0) return undefined;
  return count > BADGE_CAP ? `${BADGE_CAP}+` : String(count);
}
