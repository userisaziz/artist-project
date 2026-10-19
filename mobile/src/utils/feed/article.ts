import type { InfiniteData } from '@tanstack/react-query';
import type { Page } from '../../core/api/types';
import type { Post } from '../../types/feed/feed';

export type ArticleBlock = { kind: 'paragraph' | 'heading' | 'quote'; text: string };

/** An article body (blank-line paragraphs, `## ` headings, `> ` quotes; the backend's format) as blocks. */
export function articleBlocks(body: string): ArticleBlock[] {
  return body
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p): ArticleBlock => {
      if (p.startsWith('## ')) return { kind: 'heading', text: p.slice(3).trim() };
      if (p.startsWith('> ')) return { kind: 'quote', text: p.slice(2).trim() };
      return { kind: 'paragraph', text: p };
    });
}

/** A new copy of a paged post list with `patch` applied to the posts that `match`; other posts keep identity. */
export function patchPosts(
  data: InfiniteData<Page<Post>> | undefined,
  match: (post: Post) => boolean,
  patch: Partial<Post>,
): InfiniteData<Page<Post>> | undefined {
  if (!data) return data;
  return { ...data, pages: data.pages.map((page) => ({ ...page, items: page.items.map((p) => (match(p) ? { ...p, ...patch } : p)) })) };
}

/** 12 → '12', 1240 → '1.2k', 3400000 → '3.4M'. */
export function compactCount(n: number): string {
  if (n < 1000) return String(n);
  const [value, unit] = n < 1_000_000 ? [n / 1000, 'k'] : [n / 1_000_000, 'M'];
  return `${Number(value.toFixed(value < 10 ? 1 : 0))}${unit}`;
}

const TOPIC: Record<Post['topic'], string> = { look: 'Look', guide: 'Guide', story: 'Story' };

/** 'Guide · 6 min read' for articles, 'Look' for photo sets. */
export function topicLabel(post: Pick<Post, 'topic' | 'read_minutes'>): string {
  return post.read_minutes ? `${TOPIC[post.topic]} · ${post.read_minutes} min read` : TOPIC[post.topic];
}
