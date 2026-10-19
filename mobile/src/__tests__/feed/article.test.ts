import { articleBlocks, compactCount, patchPosts } from '../../utils/feed/article';
import { postFixture } from '../../mocks/feed/feed';

it('splits an article body into paragraphs, headings and quotes', () => {
  const body = 'The colour is decided early.\n\n## 1. Book it 48 hours early\n\n> Keep the paste on overnight.\n\nHenna keeps\ndarkening.';

  expect(articleBlocks(body)).toEqual([
    { kind: 'paragraph', text: 'The colour is decided early.' },
    { kind: 'heading', text: '1. Book it 48 hours early' },
    { kind: 'quote', text: 'Keep the paste on overnight.' },
    { kind: 'paragraph', text: 'Henna keeps\ndarkening.' },
  ]);
});

it('patches matching posts in every page without touching the others', () => {
  const a = postFixture({ id: 'p1' });
  const b = postFixture({ id: 'p2' });
  const data = { pages: [{ items: [a, b], next_cursor: null }], pageParams: [null] };

  const next = patchPosts(data, (p) => p.id === 'p2', { liked: true, like_count: 9 });

  expect(next?.pages[0].items[1]).toMatchObject({ liked: true, like_count: 9 });
  expect(next?.pages[0].items[0]).toBe(a);
  expect(data.pages[0].items[1].liked).toBe(false); // the original is untouched
});

it('compacts like counts the way the prototype shows them', () => {
  expect([12, 1240, 3400, 12_500, 3_400_000].map(compactCount)).toEqual(['12', '1.2k', '3.4k', '13k', '3.4M']);
});
