import { artistHref, artistStage, resumeStep } from '../routing';
import type { ArtistProfile } from '../../api/types';

const profile = (over: Partial<ArtistProfile> = {}): ArtistProfile => ({
  id: 'a', status: 'draft', business_name: 'B', city: 'Pune', bio: null, photo_key: 'k', photo_url: 'u',
  categories: [{ id: 1, slug: 'mehendi', name: 'Mehendi' }], services: [], photos: [],
  rejection_reason: null, submitted_at: null, reviewed_at: null, kyc: null, ...over,
});
const service = { id: 's', category_id: 1, name: 'S', price_paise: 100, duration_minutes: 60, description: null };

it('stage follows the review status; a rejection waits on In review until the artist edits', () => {
  expect(artistStage(null, false)).toBe('onboarding');
  expect(artistStage(profile(), false)).toBe('onboarding');
  expect(artistStage(profile({ status: 'pending' }), false)).toBe('review');
  expect(artistStage(profile({ status: 'pending' }), true)).toBe('review');
  expect(artistStage(profile({ status: 'rejected' }), false)).toBe('review');
  expect(artistStage(profile({ status: 'rejected' }), true)).toBe('onboarding');
  expect(artistStage(profile({ status: 'approved' }), false)).toBe('live');
});

it('a draft resumes at the first step the server has no data for', () => {
  expect(resumeStep(null)).toBe('intro');
  expect(resumeStep(profile())).toBe('services');
  expect(resumeStep(profile({ services: [service] }))).toBe('portfolio');
});

it('artistHref maps each stage to its route; editing a rejection starts at Profile', () => {
  expect(artistHref(null, false)).toBe('/artist/onboarding/intro');
  expect(artistHref(profile({ services: [service] }), false)).toBe('/artist/onboarding/portfolio');
  expect(artistHref(profile({ status: 'pending' }), false)).toBe('/artist/in-review');
  expect(artistHref(profile({ status: 'rejected' }), true)).toBe('/artist/onboarding/profile');
  expect(artistHref(profile({ status: 'approved' }), false)).toBe('/artist/home');
});
