import { categoryLine } from '../../components/directory/ArtistCardView';

const cats = [{ id: 1, name: 'Mehendi' }, { id: 2, name: 'Makeup' }];

it('shows the area with the city, like "BTM Layout, Bangalore"', () => {
  expect(categoryLine({ categories: cats, city: 'Bangalore', locality: 'BTM Layout' })).toBe('Mehendi, Makeup · BTM Layout, Bangalore');
});

it('falls back to the city for artists who have not set their area yet', () => {
  expect(categoryLine({ categories: cats, city: 'Bangalore', locality: null })).toBe('Mehendi, Makeup · Bangalore');
  expect(categoryLine({ categories: cats, city: 'Bangalore', locality: '  ' })).toBe('Mehendi, Makeup · Bangalore');
});
