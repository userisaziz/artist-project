import { z } from 'zod';
import type { PostKind } from '../../types/feed/feed';

/** A post exactly as the composer holds it: which kind, how many photos are attached, the title and text. */
export interface PostDraft {
  kind: PostKind;
  photoCount: number;
  title: string;
  text: string;
}

/**
 * What a post has to have before Post unlocks — and the one hint the composer shows when it doesn't.
 *
 * A Photos post needs photos and a caption; an Article needs a real title and a body, and its cover is
 * optional. The two kinds disagree about the order of their questions, so the issues are raised by kind
 * rather than by shape order: the hint always names the first thing that is still missing.
 */
export const postDraftSchema = z
  .object({
    kind: z.enum(['photos', 'article']),
    photoCount: z.number(),
    title: z.string(),
    text: z.string(),
  })
  .superRefine((draft, report) => {
    if (draft.kind === 'article') {
      if (draft.title.trim().length < 3) report.addIssue({ code: 'custom', path: ['title'], message: 'Add a title' });
      else if (!draft.text.trim()) report.addIssue({ code: 'custom', path: ['text'], message: 'Write your article' });
      return;
    }
    if (!draft.photoCount) report.addIssue({ code: 'custom', path: ['photoCount'], message: 'Add at least one photo' });
    else if (!draft.text.trim()) report.addIssue({ code: 'custom', path: ['text'], message: 'Write a caption' });
  });
