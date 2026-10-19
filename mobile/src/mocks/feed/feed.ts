import type { Post } from '../../types/feed/feed';

// Mirrors backend PostOut (app/feed/schemas.py).
export function postFixture(overrides: Partial<Post> = {}): Post {
  return {
    id: 'p1',
    kind: 'photos',
    topic: 'look',
    title: null,
    text: 'Priya’s bridal set: hidden initials and a peacock on the palm 💗',
    excerpt: null,
    body: null,
    read_minutes: null,
    cover_url: null,
    photos: [{ url: 'https://fake.storage/full/p1.jpg', width: 1080, height: 1350 }],
    artist: { id: 'a1', business_name: 'Ayesha Mehendi Art', photo_url: null, city: 'Bangalore', rating_average: 4.9, rating_count: 128 },
    service: { id: 's1', name: 'Bridal Classic', price_paise: 550000 },
    like_count: 12,
    liked: false,
    following: false,
    created_at: '2026-10-09T07:00:00Z',
    ...overrides,
  };
}

export function articleFixture(overrides: Partial<Post> = {}): Post {
  return postFixture({
    id: 'a-post',
    kind: 'article',
    topic: 'guide',
    title: 'How to get the darkest bridal mehendi stain',
    text: null,
    excerpt: 'The colour of your mehendi is decided long before the paste comes off.',
    body: 'The colour of your mehendi is decided long before the paste comes off.\n\n## 1. Book it 48 hours early\n\n> Keep the paste on for at least six hours.',
    read_minutes: 6,
    cover_url: 'https://fake.storage/full/cover.jpg',
    photos: [],
    ...overrides,
  });
}
