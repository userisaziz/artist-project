import { artistHref, artistStage, resumeStep } from '../../utils/artist-onboarding/routing';
import type { ArtistProfile } from '../../types/artist-onboarding/artist-onboarding';

const profile = (over: Partial<ArtistProfile> = {}): ArtistProfile => ({
  id: 'a', status: 'draft', business_name: 'B', city: 'Pune', area_id: 3, locality: 'Baner', pincode: '411045', address_line: null, latitude: null, longitude: null, bio: null, experience_years: null, languages: [], photo_key: 'k', photo_url: 'u',
  categories: [{ id: 1, slug: 'mehendi', name: 'Mehendi' }], services: [], photos: [],
  rejection_reason: null, submitted_at: null, reviewed_at: null, kyc: null, ...over,
});
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

it('a draft resumes at the first step the server has no data for; services and photos are optional', () => {
  expect(resumeStep(null)).toBe('intro');
  expect(resumeStep(profile({ area_id: null, locality: null, pincode: null }))).toBe('location'); // saved before the Location step
  expect(resumeStep(profile({ area_id: null, locality: 'Baner' }))).toBe('location'); // an old free-text area
  expect(resumeStep(profile({ pincode: null }))).toBe('location');
  expect(resumeStep(profile({ photos: [], kyc: null }))).toBe('portfolio'); // offered once, never required
  expect(resumeStep(profile({ photos: photos.slice(0, 1), kyc: null }))).toBe('identity');
  expect(resumeStep(profile({ photos: [], kyc: { aadhaar_last4: '2346' } }))).toBe('identity'); // skipped photos, moved on
  expect(resumeStep(profile({ services: [], photos, kyc: { aadhaar_last4: '2346' } }))).toBe('identity'); // on file: submit from there
});

it('artistHref maps each stage to its route; editing a rejection starts at Profile', () => {
  expect(artistHref(null, false)).toBe('/artist/onboarding/intro');
  expect(artistHref(profile(), false)).toBe('/artist/onboarding/portfolio');
  expect(artistHref(profile({ photos }), false)).toBe('/artist/onboarding/identity');
  expect(artistHref(profile({ status: 'pending' }), false)).toBe('/artist/in-review');
  expect(artistHref(profile({ status: 'rejected' }), true)).toBe('/artist/onboarding/profile');
  expect(artistHref(profile({ photos }), true)).toBe('/artist/onboarding/profile'); // a reopened approved profile
  expect(artistHref(profile({ status: 'approved' }), false)).toBe('/artist/home');
});

it('a suspended artist is kept out of the live area', () => {
  expect(artistStage({ status: 'suspended' } as Parameters<typeof artistStage>[0], false)).toBe('review');
});
