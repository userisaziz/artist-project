import { ratingLong, ratingShort, reviewCountLabel, reviewMeta, reviewStatusPill, starString } from '../format';

describe('rating labels', () => {
  it('cards show "★ 4.9 (128)", or "New" without public reviews', () => {
    expect(ratingShort(4.9, 128)).toBe('★ 4.9 (128)');
    expect(ratingShort(5, 1)).toBe('★ 5.0 (1)');
    expect(ratingShort(null, 0)).toBe('New');
  });

  it('the storefront shows "★ 4.9 · 128 reviews", singular for one, or "New"', () => {
    expect(ratingLong(4.9, 128)).toBe('★ 4.9 · 128 reviews');
    expect(ratingLong(4, 1)).toBe('★ 4.0 · 1 review');
    expect(ratingLong(null, 0)).toBe('New');
    expect(reviewCountLabel(0)).toBe('No reviews yet');
  });

  it('stars round to the nearest whole star', () => {
    expect(starString(5)).toBe('★★★★★');
    expect(starString(3)).toBe('★★★☆☆');
    expect(starString(4.4)).toBe('★★★★☆');
  });
});

describe('review card', () => {
  it('meta reads "service · month"', () => {
    expect(reviewMeta({ service_name: 'Bridal Classic', created_at: '2026-09-15T06:00:00.000Z' })).toBe('Bridal Classic · Sep 2026');
  });

  it('only non-public or reported reviews get a status pill', () => {
    expect(reviewStatusPill({ status: 'published', flag: null })).toBeNull();
    expect(reviewStatusPill({ status: 'hidden', flag: 'contact_info' })).toEqual({ label: 'Hidden: being checked', tone: 'pending' });
    expect(reviewStatusPill({ status: 'flagged', flag: 'artist_report' })).toEqual({ label: 'Reported', tone: 'danger' });
  });
});
