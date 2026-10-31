import { firstIssue } from '../../utils/common/validation';
import { productDraftSchema } from '../../utils/shop/product-draft';

const draft = (over: Partial<{ name: string; price: string; mrp: string; stock: string }>) => ({
  name: 'Bridal kit', price: '1200', mrp: '', stock: '10', ...over,
});

it('accepts a well-formed listing', () => {
  expect(firstIssue(productDraftSchema, draft({}))).toBeNull();
});

it('names the first thing still missing, in the order the form asks', () => {
  expect(firstIssue(productDraftSchema, draft({ name: ' B ' }))).toBe('Add a name');
  expect(firstIssue(productDraftSchema, draft({ price: '0' }))).toBe('Add a price');
  expect(firstIssue(productDraftSchema, draft({ mrp: '900' }))).toBe('The MRP can’t be below the price');
  expect(firstIssue(productDraftSchema, draft({ mrp: 'abc' }))).toBe('The MRP can’t be below the price');
  expect(firstIssue(productDraftSchema, draft({ stock: '1.5' }))).toBe('Stock is a whole number');
  expect(firstIssue(productDraftSchema, draft({ stock: '' }))).toBe('Stock is a whole number');
});

it('stops at the earliest problem, so one hint never hides another', () => {
  expect(firstIssue(productDraftSchema, draft({ name: '', price: '', mrp: '1', stock: '' }))).toBe('Add a name');
  expect(firstIssue(productDraftSchema, draft({ price: '', mrp: '1', stock: '' }))).toBe('Add a price');
});

it('leaves an empty MRP alone, because it is optional', () => {
  expect(firstIssue(productDraftSchema, draft({ mrp: '   ' }))).toBeNull();
});
