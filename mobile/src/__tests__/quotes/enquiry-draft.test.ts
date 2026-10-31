import { enquiryDraftSchema } from '../../utils/quotes/enquiry-draft';

const draft = (over: Partial<{ eventDate: string; details: string; budget: string }>) => ({
  eventDate: '2026-11-09', details: 'Bridal mehendi for five people', budget: '', ...over,
});

const issuesOf = (values: unknown) => enquiryDraftSchema.safeParse(values).error?.issues.map((i) => i.message) ?? [];

it('accepts a dated request with an empty budget, and sends the description trimmed', () => {
  const parsed = enquiryDraftSchema.parse(draft({ details: '  Bridal mehendi for five people  ' }));
  expect(parsed.details).toBe('Bridal mehendi for five people');
  expect(issuesOf(draft({ budget: '   ' }))).toEqual([]);
});

it('names the date and the detail in the order the form asks for them', () => {
  expect(issuesOf(draft({ eventDate: '' }))).toEqual(['Pick the date of your event.']);
  expect(issuesOf(draft({ details: 'short' }))).toEqual(['Tell the artist a little more (at least 10 characters).']);
});

it('takes a budget only as rupees', () => {
  expect(issuesOf(draft({ budget: '12,000' }))).toEqual([]);
  expect(issuesOf(draft({ budget: 'twelve thousand' }))).toEqual(['Enter the budget in rupees, or leave it empty.']);
});
