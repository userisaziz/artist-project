import type { ReactElement } from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '../../core/theme/theme-provider';
import { transport } from '../../core/api/client';
import type { TransportRequest } from '../../core/api/transport';
import { parseQuery } from '../../core/api/query-string';
import { CityProvider, useCity } from '../../context/directory/city-context';
import { AppText } from '../../components/common/AppText';
import Explore from '../../../app/customer/(tabs)/explore';

let mockParams: Record<string, string> = {};
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }), useLocalSearchParams: () => mockParams }));
jest.mock('../../context/auth/auth-provider', () => ({ useAuth: () => ({ user: null }) }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.setTimeout(20_000); // several screens' worth of renders; slow when the whole suite runs in parallel

const send = jest.spyOn(transport, 'request');
let client: QueryClient;
/** Home's view of the shared city, so the tests can see Explore keep it in step. */
function SharedCity() {
  return <AppText>{`Shared city: ${useCity().city ?? 'all'}`}</AppText>;
}
const wrap = (ui: ReactElement) => render(
  <QueryClientProvider client={client}><ThemeProvider><CityProvider>{ui}<SharedCity /></CityProvider></ThemeProvider></QueryClientProvider>,
);
const card = (id: string, name: string, city: string) => ({
  id, business_name: name, city, locality: null, photo_url: null, cover_url: null, photo_urls: [], categories: [], rating: null, review_count: 0,
  from_price_paise: null, distance_km: null, free_on: null,
});
const artistCalls = () => send.mock.calls.map(([r]) => parseQuery(r.path)).filter((q) => q.path === '/artists');

const BTM = { label: 'BTM Layout, Bangalore', name: 'BTM Layout', city: 'Bangalore', latitude: 12.9166, longitude: 77.6101, area_id: 7, source: 'area' };

function serve(cities: { status: number; json: unknown }, places: { status: number; json: unknown } = { status: 200, json: [BTM] }) {
  send.mockImplementation(async (req: TransportRequest) => {
    const { path, query } = parseQuery(req.path);
    if (path === '/categories') return { status: 200, json: [] };
    if (path === '/saved/ids') return { status: 200, json: { posts: [], artists: [], products: [] } };
    if (path === '/cities') return cities;
    if (path === '/areas/search') return places;
    if (path === '/artists') {
      const items = query.city === 'Pune' ? [card('a2', 'Pune Glam', 'Pune')]
        : query.near_lat ? [card('a1', 'Ayesha Mehendi Art', 'Bangalore')]
          : [card('a1', 'Ayesha Mehendi Art', 'Bangalore'), card('a2', 'Pune Glam', 'Pune')];
      return { status: 200, json: { items, next_cursor: null, total: items.length, radius_km: query.near_lat ? 10 : null } };
    }
    throw new Error(`unexpected request ${req.method} ${req.path}`);
  });
}

beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  send.mockReset();
  mockParams = {};
});
afterEach(() => client.clear());
afterAll(() => send.mockRestore());

it('shows every city at first, then artists around a searched area, then everywhere again', async () => {
  serve({ status: 200, json: ['Bangalore', 'Pune'] });
  await wrap(<Explore />);

  expect(await screen.findByText('Pune Glam')).toBeTruthy();
  expect(artistCalls()[0].query.city).toBeUndefined();

  await fireEvent.press(screen.getByRole('button', { name: 'Showing artists in all cities. Change city' }));
  await fireEvent.changeText(screen.getByLabelText('Search your area'), 'btm');
  await fireEvent.press(await screen.findByRole('button', { name: 'BTM Layout, Bangalore' }, { timeout: 2000 }));

  expect(await screen.findByRole('button', { name: 'Showing artists within 10 km of BTM Layout, Bangalore. Change city' })).toBeTruthy();
  expect(screen.queryByText('Pune Glam')).toBeNull();
  expect(artistCalls().at(-1)?.query).toMatchObject({ near_lat: '12.9166', near_lng: '77.6101' });
  expect(artistCalls().at(-1)?.query.city).toBeUndefined();
  expect(screen.getByText('Shared city: Bangalore')).toBeTruthy();

  await fireEvent.press(screen.getByRole('button', { name: 'Showing artists within 10 km of BTM Layout, Bangalore. Change city' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Show artists everywhere' }));
  expect(await screen.findByText('Pune Glam')).toBeTruthy();
});

it('a ?city= link picks the city for Explore and Home alike', async () => {
  serve({ status: 200, json: ['Bangalore', 'Pune'] });
  mockParams = { city: 'Pune' };
  await wrap(<Explore />);

  expect(await screen.findByText('Pune Glam')).toBeTruthy();
  expect(screen.getByText('Shared city: Pune')).toBeTruthy();
  expect(artistCalls().at(-1)?.query.city).toBe('Pune');
});

it('a failed place search says so in the sheet and keeps the list', async () => {
  serve({ status: 200, json: ['Bangalore'] }, { status: 500, json: { code: 'server_error', message: 'Something went wrong' } });
  await wrap(<Explore />);

  expect(await screen.findByText('Ayesha Mehendi Art')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Showing artists in all cities. Change city' }));
  await fireEvent.changeText(screen.getByLabelText('Search your area'), 'btm');

  expect(await screen.findByRole('alert', {}, { timeout: 2000 })).toBeTruthy();
  expect(screen.getByText('Ayesha Mehendi Art')).toBeTruthy();
});
