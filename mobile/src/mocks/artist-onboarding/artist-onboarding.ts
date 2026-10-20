import type { ArtistProfile, ServiceItem } from '../../types/artist-onboarding/artist-onboarding';

// Test fixtures mirroring backend app/artist/schemas.py ArtistProfileOut / ServiceOut.

export const templateServiceFixture: ServiceItem = {
  id: '0b6d1c2e-1111-4a5b-8c9d-000000000001',
  category_id: 12,
  subcategory_id: 12,
  template_id: 3,
  name: 'Bridal makeup',
  price_paise: 1_500_000,
  duration_minutes: 120,
  description: null,
  status: 'approved',
  rejection_reason: null,
};

export const customServiceFixture: ServiceItem = {
  ...templateServiceFixture,
  id: '0b6d1c2e-1111-4a5b-8c9d-000000000002',
  template_id: null,
  name: 'Saree draping',
  price_paise: 80_000,
  duration_minutes: 45,
  status: 'pending',
};

export function artistProfileFixture(overrides: Partial<ArtistProfile> = {}): ArtistProfile {
  return {
    id: '9a8b7c6d-2222-4e5f-8a9b-000000000001',
    status: 'approved',
    business_name: 'Asha Bridal Studio',
    city: 'Bengaluru',
    bio: null,
    photo_key: 'artists/9a8b/photo.jpg',
    photo_url: 'https://cdn.example.com/artists/9a8b/photo.jpg',
    categories: [{ id: 1, slug: 'makeup', name: 'Makeup' }],
    services: [templateServiceFixture],
    photos: [],
    kyc: { aadhaar_last4: '1234' },
    rejection_reason: null,
    submitted_at: '2026-10-01T10:00:00Z',
    reviewed_at: '2026-10-02T10:00:00Z',
    ...overrides,
  };
}
