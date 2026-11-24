import { checkAnswers, formatAnswer, valuesFor } from '../../utils/catalog/fields';
import type { FieldDef } from '../../types/catalog/catalog';

const field = (over: Partial<FieldDef>): FieldDef => ({
  key: 'k', label: 'Field', scope: 'booking', type: 'text', required: false, options: [], min: null, max: null, unit: null, help: null, ...over,
});
const NAME = field({ key: 'name', label: "Baby's name", required: true });
const BOXES = field({ key: 'boxes', label: 'Boxes', type: 'number', min: 10, max: 500, unit: 'boxes' });
const ON = field({ key: 'on', label: 'Delivery date', type: 'date' });

it('requires required answers and checks types like the server', () => {
  expect(checkAnswers([NAME], {}).error).toBe("“Baby's name” is required");
  expect(checkAnswers([NAME], { name: '   ' }).error).toBe("“Baby's name” is required");
  expect(checkAnswers([BOXES], { boxes: 5 }).error).toBe('“Boxes” must be between 10 and 500');
  expect(checkAnswers([ON], { on: '24/11/2026' }).error).toBe('Enter “Delivery date” as YYYY-MM-DD');
});

it('trims text and drops empty optional answers', () => {
  expect(checkAnswers([NAME, BOXES, ON], { name: ' Ayaan ', boxes: undefined, on: '' })).toEqual({ answers: { name: 'Ayaan' }, error: null });
});

it('formats answers for display', () => {
  expect(formatAnswer({ value: 300, unit: 'photos' })).toBe('300 photos');
  expect(formatAnswer({ value: ['Wrists', 'Elbows'], unit: null })).toBe('Wrists, Elbows');
  expect(formatAnswer({ value: true, unit: null })).toBe('Yes');
});

it('keeps only saved values the fields still ask for', () => {
  expect(valuesFor([NAME], { name: 'Sara', gone: 'x' })).toEqual({ name: 'Sara' });
});
