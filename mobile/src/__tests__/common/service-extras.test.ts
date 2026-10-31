import { firstIssue } from '../../utils/common/validation';
import { draftFromService, extrasDraftSchema } from '../../utils/common/service-extras';

it('turns the editor draft into the API input, trimming and skipping blank items', () => {
  const parsed = extrasDraftSchema.parse({
    included: ['  Bridal hands ', '', 'Custom design'],
    addons: [
      { name: ' Guest mehendi ', price: '500', perPerson: true },
      { name: 'Organic henna', price: '400', perPerson: false },
    ],
  });
  expect(parsed).toEqual({
    included_items: ['Bridal hands', 'Custom design'],
    addons: [
      { name: 'Guest mehendi', price_paise: 50000, per_person: true },
      { name: 'Organic henna', price_paise: 40000, per_person: false },
    ],
  });
});

it('refuses an add-on without a name or a whole-rupee price', () => {
  expect(firstIssue(extrasDraftSchema, { included: [], addons: [{ name: '', price: '500', perPerson: false }] })).toBe('Give every add-on a name.');
  expect(firstIssue(extrasDraftSchema, { included: [], addons: [{ name: 'Guests', price: '0', perPerson: true }] })).toBe('Enter a price above ₹0 for “Guests”.');
  expect(firstIssue(extrasDraftSchema, { included: [], addons: [{ name: 'Guests', price: '12.5', perPerson: true }] })).not.toBeNull();
});

it('starts the editor from a saved service', () => {
  expect(draftFromService({ included_items: ['Lashes'], addons: [{ id: 'x', name: 'Hair', price_paise: 150000, per_person: false }] })).toEqual({
    included: ['Lashes'],
    addons: [{ name: 'Hair', price: '1500', perPerson: false }],
  });
});
