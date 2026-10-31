import { firstIssue } from '../../utils/common/validation';
import { postDraftSchema } from '../../utils/feed/post-draft';

const draft = (over: Partial<{ kind: 'photos' | 'article'; photoCount: number; title: string; text: string }>) => ({
  kind: 'photos' as const, photoCount: 1, title: '', text: 'The stain after a week', ...over,
});

it('accepts a photo post that has photos and a caption', () => {
  expect(firstIssue(postDraftSchema, draft({}))).toBeNull();
});

it('accepts an article with a real title and a body, cover or not', () => {
  expect(firstIssue(postDraftSchema, draft({ kind: 'article', photoCount: 0, title: 'Bridal stain', text: 'Sit still for an hour.' }))).toBeNull();
});

it('names what a photo post is still missing', () => {
  expect(firstIssue(postDraftSchema, draft({ photoCount: 0 }))).toBe('Add at least one photo');
  expect(firstIssue(postDraftSchema, draft({ text: '   ' }))).toBe('Write a caption');
});

it('asks an article for its title before its body', () => {
  expect(firstIssue(postDraftSchema, draft({ kind: 'article', title: 'Br', text: '' }))).toBe('Add a title');
  expect(firstIssue(postDraftSchema, draft({ kind: 'article', title: 'Bridal stain', text: '' }))).toBe('Write your article');
});
