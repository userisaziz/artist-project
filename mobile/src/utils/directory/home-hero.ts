import { formatPrice } from '../common/format';
import type { ArtistCard } from '../../types/directory/directory';

interface Slide {
  eyebrow: string;
  categorySlug?: string;
}

const inCategory = (artist: ArtistCard, slug: string) => artist.categories.some((c) => c.name.toLowerCase() === slug);

/** The hero slides worth showing: only categories with at least one listed artist, so a slide never opens an empty
 *  Explore. A slide gets the design's "MEHENDI · FROM ₹1,500" from its cheapest priced artist. Slides without a
 *  category always stay. */
export function liveSlides<T extends Slide>(slides: T[], artists: ArtistCard[]): T[] {
  return slides.flatMap((s) => {
    const slug = s.categorySlug;
    if (!slug) return [s];
    const listed = artists.filter((a) => inCategory(a, slug));
    if (!listed.length) return [];
    const prices = listed.flatMap((a) => (a.from_price_paise === null ? [] : [a.from_price_paise]));
    return [prices.length ? { ...s, eyebrow: `${s.eyebrow} · FROM ${formatPrice(Math.min(...prices))}` } : s];
  });
}
