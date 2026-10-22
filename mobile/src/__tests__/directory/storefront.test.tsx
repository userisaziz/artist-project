import type { ReactElement } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '../../core/theme/theme-provider';
import { transport } from '../../core/api/client';
import type { TransportRequest } from '../../core/api/transport';
import ArtistStorefrontScreen from '../../../app/customer/artist/[id]';
import { Storefront } from '../../components/directory/Storefront';
import { articleFixture, postFixture } from '../../mocks/feed/feed';
import type { ArtistPublic, PublicService } from '../../types/directory/directory';

const mockPush = jest.fn();
jest.mock('../../context/auth/auth-provider', () => ({
  useAuth: () => ({ user: jest.requireActual('../../mocks/auth/auth').userFixture }),
}));
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), push: mockPush }),
  useLocalSearchParams: () => ({ id: 'a1' }),
  useIsFocused: () => true,
}));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));

const NO_REVIEWS = { items: [], next_cursor: null, summary: { average: null, count: 0, distribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 } } };

const service = (id: string, name: string, booking_count: number, price_paise: number): PublicService => ({
  id, name, description: null, price_paise, duration_minutes: 180, booking_count, included_items: [], addons: [],
  category: { id: 1, name: 'Mehendi' }, subcategory: { id: 2, name: 'Bridal' },
});

// Mirrors backend GET /artists/{id} (app/directory/schemas.py).
const artist = (overrides: Partial<ArtistPublic> = {}): ArtistPublic => ({
  id: 'a1', business_name: 'Ayesha Mehendi Art', city: 'Bangalore', locality: null, photo_url: null, cover_url: null,
  photo_urls: [], distance_km: null, free_on: null, categories: [{ id: 1, name: 'Mehendi' }], from_price_paise: 550000,
  rating: 4.9, review_count: 128, bio: 'Bridal mehendi for twelve years.', photos: [], member_since: '2026-01-10T00:00:00Z',
  completed_bookings: 640, hours: [], travel_radius_km: 15, next_free_date: '2026-10-23', reply_minutes: 10,
  services: [service('s1', 'Bridal Classic', 3, 550000), service('s2', 'Bridal Signature', 9, 900000)],
  ...overrides,
});

const send = jest.spyOn(transport, 'request');
let client: QueryClient;
const wrap = (ui: ReactElement) => render(<QueryClientProvider client={client}><ThemeProvider>{ui}</ThemeProvider></QueryClientProvider>);

/** Answers by method + path (query included); the reviews preview and saved list are always empty here. */
function serve(routes: Record<string, unknown>) {
  send.mockImplementation(async (req: TransportRequest) => {
    const key = `${req.method} ${req.path}`;
    if (key.startsWith('GET /artists/a1/reviews')) return { status: 200, json: NO_REVIEWS };
    if (key === 'GET /saved/ids') return { status: 200, json: { posts: [], artists: [], products: [] } };
    if (!(key in routes)) throw new Error(`unexpected request ${key}`);
    const route = routes[key];
    const answer = typeof route === 'function' ? (route as (r: TransportRequest) => unknown)(req) : route;
    return typeof answer === 'object' && answer !== null && 'status' in answer ? (answer as { status: number; json: unknown }) : { status: 200, json: answer };
  });
}

const posts = [articleFixture({ id: 'p1', title: 'How to get the darkest stain' }), postFixture({ id: 'p2', text: 'Priya’s bridal set' })];
const customerRoutes = (overrides: Record<string, unknown> = {}) => ({
  'GET /artists/a1': artist(),
  'GET /feed?artist_id=a1&limit=2': { items: posts, next_cursor: null },
  'GET /feed/artists/a1/follow': { following: false },
  ...overrides,
});

beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false } } });
  send.mockReset();
  mockPush.mockReset();
});
afterEach(() => client.clear());
afterAll(() => send.mockRestore());

it('shows the artist, their numbers, availability, the most booked package and their posts', async () => {
  serve(customerRoutes());
  await wrap(<ArtistStorefrontScreen />);

  expect(await screen.findByText('Verified artist')).toBeTruthy();
  expect(screen.getByText('640')).toBeTruthy();
  expect(screen.getByText('10m')).toBeTruthy();
  expect(screen.getByText('Replies in')).toBeTruthy();
  expect(screen.getByText('Next free: Fri, 23 Oct')).toBeTruthy();
  expect(screen.getByText('Travels 15 km')).toBeTruthy();
  expect(screen.getAllByText('Most booked')).toHaveLength(1);
  expect(screen.getByLabelText('Bridal Signature, most booked, ₹9,000')).toBeTruthy();
  expect(screen.getAllByText('2 packages')).toHaveLength(2); // the Services heading and the pinned footer
  expect(screen.getByText('from ₹5,500')).toBeTruthy();
  expect(await screen.findByText('How to get the darkest stain')).toBeTruthy();
});

it('asks which package before Date & time when there are several', async () => {
  serve(customerRoutes());
  await wrap(<ArtistStorefrontScreen />);

  fireEvent.press(await screen.findByRole('button', { name: 'Check availability' }));
  fireEvent.press(await screen.findByRole('button', { name: 'Book Bridal Classic' }));

  expect(mockPush).toHaveBeenCalledWith({ pathname: '/customer/book/[artistId]', params: { artistId: 'a1', serviceId: 's1' } });
});

it('goes straight to Date & time when there is one package', async () => {
  serve(customerRoutes({ 'GET /artists/a1': artist({ services: [service('s1', 'Bridal Classic', 0, 550000)] }) }));
  await wrap(<ArtistStorefrontScreen />);

  fireEvent.press(await screen.findByRole('button', { name: 'Book now' }));

  expect(mockPush).toHaveBeenCalledWith({ pathname: '/customer/book/[artistId]', params: { artistId: 'a1', serviceId: 's1' } });
  expect(screen.queryByText('Choose a package')).toBeNull();
});

it('opens a package and a post from the page', async () => {
  serve(customerRoutes());
  await wrap(<ArtistStorefrontScreen />);

  fireEvent.press(await screen.findByLabelText('Bridal Classic, ₹5,500'));
  fireEvent.press(await screen.findByRole('button', { name: /How to get the darkest stain/ }));

  expect(mockPush).toHaveBeenCalledWith({ pathname: '/customer/artist/[id]/service/[serviceId]', params: { id: 'a1', serviceId: 's1' } });
  expect(mockPush).toHaveBeenCalledWith({ pathname: '/customer/post/[id]', params: { id: 'p1' } });
});

it('follows the artist', async () => {
  const followed: string[] = [];
  serve(customerRoutes({ 'PUT /feed/artists/a1/follow': (req: TransportRequest) => { followed.push(req.path); return { following: true }; } }));
  await wrap(<ArtistStorefrontScreen />);

  fireEvent.press(await screen.findByRole('button', { name: 'Follow Ayesha Mehendi Art' }));

  await waitFor(() => expect(followed).toHaveLength(1));
  expect(await screen.findByRole('button', { name: 'Unfollow Ayesha Mehendi Art' })).toBeTruthy();
});

it('offers a retry when the artist cannot be loaded', async () => {
  serve(customerRoutes({ 'GET /artists/a1': { status: 500, json: { detail: 'Something went wrong' } } }));
  await wrap(<ArtistStorefrontScreen />);

  expect(await screen.findByRole('button', { name: 'Try again' })).toBeTruthy();
});

it('the artist’s own preview has no booking and reads nothing from the customer feed', async () => {
  serve({ 'GET /artists/a1': artist() });
  await wrap(<Storefront artistId="a1" />);

  expect(await screen.findByText('Verified artist')).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Book now' })).toBeNull();
  expect(screen.queryByText('Check availability')).toBeNull();
  expect(send.mock.calls.some(([req]) => req.path.startsWith('/feed'))).toBe(false);
});
