import { firstIssue } from '../../utils/common/validation';
import { savedAddressDraftSchema } from '../../utils/addresses/address-draft';

it('hands back the label and address trimmed', () => {
  expect(savedAddressDraftSchema.parse({ label: ' Home ', address: '  Flat 2, MG Road  ' })).toEqual({
    label: 'Home', address: 'Flat 2, MG Road',
  });
});

it('asks for a label, then for a full address', () => {
  expect(firstIssue(savedAddressDraftSchema, { label: '  ', address: 'Flat 2, MG Road' })).toBe('Add a label');
  expect(firstIssue(savedAddressDraftSchema, { label: 'Home', address: 'abcd' })).toBe('Add the full address, including the PIN');
});
