import { placeLine } from '../../utils/directory/place';
import { parsePlace } from '../../utils/directory/place-store';
import type { CustomerPlace } from '../../types/directory/directory';

const BTM: CustomerPlace = { label: 'BTM Layout, Bangalore', city: 'Bangalore', areaId: 7, coords: { latitude: 12.9166, longitude: 77.6101 }, source: 'search' };

it('says how far around the place the artists are, as the server widened it', () => {
  expect(placeLine(BTM, 5)).toBe('within 5 km of BTM Layout, Bangalore');
  expect(placeLine(BTM, 10)).toBe('within 10 km of BTM Layout, Bangalore');
  expect(placeLine(BTM, 2.5)).toBe('within 2.5 km of BTM Layout, Bangalore');
  expect(placeLine(BTM, null)).toBe('near BTM Layout, Bangalore');
});

it('names a GPS point outside every area as "you", a whole city by name, and no place as everywhere', () => {
  expect(placeLine({ ...BTM, label: 'Near you', areaId: null, city: null, source: 'gps' }, 5)).toBe('within 5 km of you');
  expect(placeLine({ label: 'Pune', city: 'Pune', areaId: null, coords: null, source: 'city' }, null)).toBe('in Pune');
  expect(placeLine(null, null)).toBe('in all cities');
});

it('reads a saved place back, and anything malformed as none', () => {
  expect(parsePlace(JSON.stringify(BTM))).toEqual(BTM);
  expect(parsePlace(JSON.stringify({ ...BTM, source: 'teleport' }))).toBeNull();
  expect(parsePlace(JSON.stringify({ ...BTM, coords: { latitude: 'x' } }))).toBeNull();
  expect(parsePlace('not json')).toBeNull();
  expect(parsePlace(null)).toBeNull();
});
