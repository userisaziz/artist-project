import type { ReactElement } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '../../core/theme/theme-provider';
import { transport } from '../../core/api/client';
import type { TransportRequest } from '../../core/api/transport';
import { parseQuery } from '../../core/api/query-string';
import { CityProvider } from '../../context/directory/city-context';
import type { ArtistCard } from '../../types/directory/directory';
import Explore from '../../../app/customer/(tabs)/explore';

const mockPush = jest.fn();
const mockPosition = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }), useLocalSearchParams: () => ({}) }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('../../core/location/location', () => ({
  ...jest.requireActual('../../core/location/location'),
  currentPosition: () => mockPosition(),
}));
jest.mock('../../context/auth/auth-provider', () => ({ useAuth: () => ({ user: null }) }));
jest.setTimeout(20_000);

// Mirrors backend GET /artists (app/directory/schemas.py ArtistCard).
const card = (over: Partial<ArtistCard>): ArtistCard => ({
  id: 'a1', business_name: 'Ayesha Mehendi Art', city: 'Bangalore', locality: 'Koramangala', photo_url: null, cover_url: null,
  photo_urls: ['https://cdn/1.jpg', 'https://cdn/2.jpg', 'https://cdn/3.jpg'], categories: [{ id: 1, name: 'Mehendi' }],
  from_price_paise: 150000, rating: 4.9, review_count: 128, distance_km: null, free_on: null, ...over,
});
const AYESHA = card({});
const NOOR = card({ id: 'a2', business_name: 'Henna by Noor', locality: 'Jayanagar', rating: 4.7, review_count: 870, from_price_paise: 300000 });

const send = jest.spyOn(transport, 'request');
let client: QueryClient;
const wrap = (ui: ReactElement) => render(
  <QueryClientProvider client={client}><ThemeProvider><CityProvider>{ui}</CityProvider></ThemeProvider></QueryClientProvider>,
);
const searches = () => send.mock.calls.map(([r]) => parseQuery(r.path)).filter((q) => q.path === '/artists').map((q) => q.query);

function serve(artists: (query: Record<string, string>) => { status: number; json: unknown }) {
  send.mockImplementation(async (req: TransportRequest) => {
    const { path, query } = parseQuery(req.path);
    if (path === '/categories') return { status: 200, json: [] };
    if (path === '/cities') return { status: 200, json: ['Bangalore', 'Pune'] };
    if (path === '/saved/ids') return { status: 200, json: { posts: [], artists: [], products: [] } };
    if (path === '/artists') return artists(query);
    throw new Error(`unexpected request ${req.method} ${req.path}`);
  });
}
const page = (items: ArtistCard[], total: number | null = items.length) => ({ status: 200, json: { items, next_cursor: null, total } });

beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  send.mockReset();
  mockPush.mockReset();
  mockPosition.mockReset();
});
afterEach(() => client.clear());
afterAll(() => send.mockRestore());

it('shows the total, a featured first artist and compact rows, recommended first', async () => {
  serve(() => page([AYESHA, NOOR], 86));
  await wrap(<Explore />);

  expect(await screen.findByText('86 artists')).toBeTruthy();
  expect(screen.getByText('Ayesha Mehendi Art')).toBeTruthy();
  expect(screen.getByText('Mehendi · Koramangala')).toBeTruthy();
  expect(screen.getByText('Mehendi · Jayanagar')).toBeTruthy();
  expect(searches()[0].sort).toBe('recommended');

  await fireEvent.press(screen.getByRole('button', { name: /Henna by Noor/ }));
  expect(mockPush).toHaveBeenCalledWith({ pathname: '/customer/artist/[id]', params: { id: 'a2' } });
});

it('a new filter keeps the current artists on screen until its results arrive', async () => {
  serve((q) => (q.min_rating ? new Promise(() => {}) as never : page([AYESHA])));
  await wrap(<Explore />);
  await screen.findByText('Ayesha Mehendi Art');

  await fireEvent.press(screen.getByRole('button', { name: 'Rated 4.8 and up' }));
  await waitFor(() => expect(searches().at(-1)?.min_rating).toBe('4.8'));

  expect(screen.getByText('Ayesha Mehendi Art')).toBeTruthy();
});

it('rating, home visit and price filters and the sort sheet go to the server', async () => {
  serve(() => page([AYESHA]));
  await wrap(<Explore />);
  await screen.findByText('Ayesha Mehendi Art');

  await fireEvent.press(screen.getByRole('button', { name: 'Rated 4.8 and up' }));
  await waitFor(() => expect(searches().at(-1)?.min_rating).toBe('4.8'));
  await fireEvent.press(screen.getByRole('button', { name: 'Home visit' }));
  await waitFor(() => expect(searches().at(-1)?.home_visit).toBe('true'));

  await fireEvent.press(screen.getByRole('button', { name: 'Price' }));
  await fireEvent.press(await screen.findByRole('button', { name: 'Under ₹5,000' }));
  await waitFor(() => expect(searches().at(-1)?.max_price_paise).toBe('500000'));

  await fireEvent.press(screen.getByRole('button', { name: 'Sort: Recommended' }));
  await fireEvent.press(await screen.findByRole('button', { name: 'Price: low to high' }));
  await waitFor(() => expect(searches().at(-1)?.sort).toBe('price'));
});

it('Near me asks the phone where it is, then sorts by distance and shows it', async () => {
  mockPosition.mockResolvedValue({ latitude: 12.9352, longitude: 77.6245 });
  serve((q) => page(q.near_lat ? [card({ distance_km: 2.1 })] : [AYESHA]));
  await wrap(<Explore />);
  await screen.findByText('Ayesha Mehendi Art');

  await fireEvent.press(screen.getByRole('button', { name: 'Near me' }));

  expect(await screen.findByText('Mehendi · Koramangala · 2.1 km')).toBeTruthy();
  expect(searches().at(-1)).toMatchObject({ near_lat: '12.9352', near_lng: '77.6245', sort: 'nearest' });
});

it('a refused location permission says so and keeps the list', async () => {
  const { LocationError } = jest.requireActual('../../core/location/location');
  mockPosition.mockRejectedValue(new LocationError('denied'));
  serve(() => page([AYESHA]));
  await wrap(<Explore />);
  await screen.findByText('Ayesha Mehendi Art');

  await fireEvent.press(screen.getByRole('button', { name: 'Near me' }));

  expect(await screen.findByText(/Allow location access in Settings/)).toBeTruthy();
  expect(screen.getByText('Ayesha Mehendi Art')).toBeTruthy();
});

it('no matches offers to clear the filters; a failed search offers a retry', async () => {
  serve((q) => (q.min_rating ? page([]) : { status: 500, json: { code: 'server_error', message: 'Something went wrong' } }));
  await wrap(<Explore />);
  expect(await screen.findByRole('button', { name: 'Try again' })).toBeTruthy();

  await fireEvent.press(screen.getByRole('button', { name: 'Rated 4.8 and up' }));
  expect(await screen.findByText('No artists match these filters.')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Clear filters' }));
  await waitFor(() => expect(searches().at(-1)?.min_rating).toBeUndefined());
});
