import { addLine, cartCount, cartTotal, groupBySeller, setQuantity } from '../../utils/shop/cart';
import { productFixture } from '../../mocks/shop/shop';

const cones = productFixture();
const kit = productFixture({
  id: 'pr-2', name: 'Pastel bridal lip kit', price_paise: 115000, stock: 3,
  seller: { id: 'a2', business_name: 'Meher by Riya', city: 'Mumbai', photo_url: null },
  payment_methods: ['pay_on_delivery', 'pay_before_shipping'],
});

it('adds to the cart without mutating it, capped by stock', () => {
  const start = addLine([], kit, 2);
  const more = addLine(start, kit, 5);

  expect(start[0].quantity).toBe(2);
  expect(more[0].quantity).toBe(3);
  expect(cartCount(more)).toBe(3);
});

it('setting a quantity to zero removes the line', () => {
  expect(setQuantity(addLine([], cones), cones.id, 0)).toEqual([]);
});

it('groups the cart by seller with subtotals and the payment methods all products accept', () => {
  const balm = productFixture({ id: 'pr-3', price_paise: 35000, payment_methods: ['pay_on_delivery', 'pay_before_shipping'] });
  const lines = addLine(addLine(addLine([], cones, 2), kit), balm);

  const groups = groupBySeller(lines);

  expect(groups.map((g) => [g.seller.business_name, g.subtotal_paise, g.methods])).toEqual([
    ['Ayesha Mehendi Art', 96000 + 35000, ['pay_on_delivery']],
    ['Meher by Riya', 115000, ['pay_on_delivery', 'pay_before_shipping']],
  ]);
  expect(cartTotal(lines)).toBe(96000 + 35000 + 115000);
});
