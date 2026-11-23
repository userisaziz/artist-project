import { liveSlides } from '../../utils/directory/home-hero';
import type { ArtistCard } from '../../types/directory/directory';

const artist = (over: Partial<ArtistCard>): ArtistCard => ({
  id: 'a1', business_name: 'Ayesha Mehendi Art', city: 'Bangalore', photo_url: null, cover_url: null,
  categories: [{ id: 1, name: 'Mehendi' }], from_price_paise: 150000, rating: null, review_count: 0,
  locality: null, photo_urls: [], distance_km: null, free_on: null, ...over,
});
const SLIDES = [
  { eyebrow: 'MEHENDI', categorySlug: 'mehendi' },
  { eyebrow: 'MAKEUP & HAIR', categorySlug: 'makeup' },
  { eyebrow: 'WELCOME' },
];

it('keeps only slides whose category someone offers, with the cheapest price', () => {
  const artists = [artist({}), artist({ id: 'a2', from_price_paise: 120000 })];
  expect(liveSlides(SLIDES, artists).map((s) => s.eyebrow)).toEqual(['MEHENDI · FROM ₹1,200', 'WELCOME']);
});

it('keeps a slide without a price when its artists have none listed', () => {
  expect(liveSlides(SLIDES, [artist({ from_price_paise: null })]).map((s) => s.eyebrow)).toEqual(['MEHENDI', 'WELCOME']);
});

it('drops every category slide when nobody is listed', () => {
  expect(liveSlides(SLIDES, []).map((s) => s.eyebrow)).toEqual(['WELCOME']);
});
