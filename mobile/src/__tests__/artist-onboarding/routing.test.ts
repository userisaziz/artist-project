import { artistHref, artistStage, resumeStep } from '../../utils/artist-onboarding/routing';
import type { ArtistProfile } from '../../types/artist-onboarding/artist-onboarding';

const profile = (over: Partial<ArtistProfile> = {}): ArtistProfile => ({
  id: 'a', status: 'draft', business_name: 'B', city: 'Pune', bio: null, photo_key: 'k', photo_url: 'u',
  categories: [{ id: 1, slug: 'mehendi', name: 'Mehendi' }], services: [], photos: [],
  rejection_reason: null, submitted_at: null, reviewed_at: null, kyc: null, ...over,
});
const service = {
  id: 's', category_id: 101, subcategory_id: 101, template_id: 1001, name: 'S', price_paise: 100, duration_minutes: 60,
  description: null, status: 'approved' as const, rejection_reason: null,
};
const photos = Array.from({ length: 6 }, (_, i) => ({ id: `p${i}`, key: `k${i}`, width: 1, height: 1, thumb_url: 'u', card_url: 'u', full_url: 'u' }));

it('stage follows the review status; a rejection waits on In review until the artist edits', () => {
  expect(artistStage(null, false)).toBe('onboarding');
  expect(artistStage(profile(), false)).toBe('onboarding');
  expect(artistStage(profile({ status: 'pending' }), false)).toBe('review');
  expect(artistStage(profile({ status: 'pending' }), true)).toBe('review');
  expect(artistStage(profile({ status: 'rejected' }), false)).toBe('review');
  expect(artistStage(profile({ status: 'rejected' }), true)).toBe('onboarding');
  expect(artistStage(profile({ status: 'approved' }), false)).toBe('live');
});

it('a draft resumes at the first step the server has no data for; six photos go on to Identity', () => {
  expect(resumeStep(null)).toBe('intro');
  expect(resumeStep(profile())).toBe('services');
  expect(resumeStep(profile({ services: [service] }))).toBe('portfolio');
  expect(resumeStep(profile({ services: [service], photos: photos.slice(0, 5) }))).toBe('portfolio');
  expect(resumeStep(profile({ services: [service], photos }))).toBe('identity');
  expect(resumeStep(profile({ services: [service], photos, kyc: { aadhaar_last4: '2346' } }))).toBe('identity'); // on file: submit from there
});

it('artistHref maps each stage to its route; editing a rejection starts at Profile', () => {
  expect(artistHref(null, false)).toBe('/artist/onboarding/intro');
  expect(artistHref(profile({ services: [service] }), false)).toBe('/artist/onboarding/portfolio');
  expect(artistHref(profile({ services: [service], photos }), false)).toBe('/artist/onboarding/identity');
  expect(artistHref(profile({ status: 'pending' }), false)).toBe('/artist/in-review');
  expect(artistHref(profile({ status: 'rejected' }), true)).toBe('/artist/onboarding/profile');
  expect(artistHref(profile({ status: 'approved' }), false)).toBe('/artist/home');
});

it('a suspended artist is kept out of the live area', () => {
  expect(artistStage({ status: 'suspended' } as Parameters<typeof artistStage>[0], false)).toBe('review');
});
