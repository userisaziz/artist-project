import { firstIssue } from '../../utils/common/validation';
import { checkoutDraftSchema } from '../../utils/shop/checkout-draft';

it('hands back the delivery address trimmed', () => {
  expect(checkoutDraftSchema.parse({ address: '  Flat 1204, Koramangala, Bangalore 560034 ' })).toEqual({
    address: 'Flat 1204, Koramangala, Bangalore 560034',
  });
});

it('wants ten characters after trimming, so a saved short address is not enough to ship to', () => {
  const said = 'Add the full address, including the PIN';
  expect(firstIssue(checkoutDraftSchema, { address: 'MG Road' })).toBe(said);
  expect(firstIssue(checkoutDraftSchema, { address: '   ' })).toBe(said);
});
