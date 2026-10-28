import type { ReactElement } from 'react';
import { AccessibilityInfo } from 'react-native';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '../../core/theme/theme-provider';
import { transport } from '../../core/api/client';
import type { TransportRequest } from '../../core/api/transport';
import type { ArtistCard } from '../../types/directory/directory';
import { CityProvider } from '../../context/directory/city-context';
import CustomerHome from '../../../app/customer/(tabs)/home';

const mockPush = jest.fn();
const mockNavigate = jest.fn();
jest.mock('../../context/auth/auth-provider', () => ({
  useAuth: () => ({ user: jest.requireActual('../../mocks/auth/auth').userFixture }),
}));
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush, navigate: mockNavigate }) }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
const mockPosition = jest.fn();
jest.mock('../../core/location/location', () => ({
  ...jest.requireActual('../../core/location/location'),
  currentPosition: () => mockPosition(),
}));
const { LocationError } = jest.requireActual('../../core/location/location');

jest.setTimeout(20_000);

const artist = (over: Partial<ArtistCard>): ArtistCard => ({
  id: 'a1', business_name: 'Ayesha Mehendi Art', city: 'Bangalore', photo_url: null, cover_url: null,
  categories: [{ id: 1, name: 'Mehendi' }], from_price_paise: 150000, rating: 4.6, review_count: 12,
  locality: null, photo_urls: [], distance_km: null, free_on: null, ...over,
});
const ARTISTS = [
  artist({}),
  artist({ id: 'a2', business_name: 'Kavya Hair Atelier', categories: [{ id: 3, name: 'Hair' }], rating: 5, review_count: 40 }),
  artist({ id: 'a3', business_name: 'Fresh Studio', rating: null, review_count: 0 }),
];
const CATEGORIES = [
  { id: 1, slug: 'mehendi', name: 'Mehendi', subcategories: [] },
  { id: 2, slug: 'photography', name: 'Photography', subcategories: [] },
];

const BTM_RESULT = { label: 'BTM Layout, Bangalore', name: 'BTM Layout', city: 'Bangalore', latitude: 12.9166, longitude: 77.6101, area_id: 7, source: 'area' };
const send = jest.spyOn(transport, 'request');
const sent: string[] = [];
const paths: string[] = [];
let client: QueryClient;
const wrap = (ui: ReactElement) => render(<QueryClientProvider client={client}><ThemeProvider><CityProvider>{ui}</CityProvider></ThemeProvider></QueryClientProvider>);
function serve(artistsStatus = 200) {
  send.mockImplementation(async (req: TransportRequest) => {
    const key = `${req.method} ${req.path.split('?')[0]}`;
    sent.push(key);
    paths.push(req.path);
    const routes: Record<string, { status: number; json: unknown }> = {
      'GET /categories': { status: 200, json: CATEGORIES },
      'GET /cities': { status: 200, json: ['Bangalore', 'Mumbai'] },
      'GET /artists': artistsStatus === 200 ? { status: 200, json: { items: ARTISTS, next_cursor: null, radius_km: req.path.includes('near_lat') ? 5 : null } } : { status: artistsStatus, json: { detail: 'Server error' } },
      'GET /saved/ids': { status: 200, json: { posts: [], artists: [], products: [] } },
      'GET /notifications/unread-count': { status: 200, json: { count: 0 } },
      'GET /areas/nearest': { status: 200, json: { id: 7, city: 'Bangalore', name: 'BTM Layout', latitude: 12.9166, longitude: 77.6101 } },
      'GET /areas/search': { status: 200, json: [BTM_RESULT] },
    };
    return (routes[key] ?? { status: 204, json: null }) as { status: number; json: unknown };
  });
}

beforeEach(() => {
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true); // no hero auto-advance mid-test
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false } } });
  sent.length = 0;
  paths.length = 0;
  send.mockReset();
  mockPush.mockReset();
  mockNavigate.mockReset();
  mockPosition.mockReset();
  mockPosition.mockRejectedValue(new LocationError('denied')); // most tests: the customer said no
});
afterEach(() => client.clear());
afterAll(() => send.mockRestore());

it('shows services, nearby artists and top rated artists, best rated first', async () => {
  serve();
  await wrap(<CustomerHome />);

  expect(await screen.findByText('Services')).toBeTruthy();
  await fireEvent.press(await screen.findByRole('button', { name: 'Photography artists' }));
  expect(mockNavigate).toHaveBeenCalledWith({ pathname: '/customer/explore', params: { categoryId: '2' } });

  const topRated = await screen.findByLabelText('Top rated artists');
  const names = within(topRated).getAllByText(/Kavya Hair Atelier|Ayesha Mehendi Art|Fresh Studio/).map((n) => n.props.children);
  expect(names).toEqual(['Kavya Hair Atelier', 'Ayesha Mehendi Art']); // unrated artists are left out
});

it('saves an artist from its tile', async () => {
  serve();
  await wrap(<CustomerHome />);

  await fireEvent.press(await screen.findByRole('button', { name: 'Save Ayesha Mehendi Art' }));
  await waitFor(() => expect(sent).toContain('PUT /saved/artist/a1'));
});

it('links to explore, the shop and messages', async () => {
  serve();
  await wrap(<CustomerHome />);

  await fireEvent.press(await screen.findByRole('button', { name: 'See all artists' }));
  expect(mockNavigate).toHaveBeenCalledWith('/customer/explore');
  await fireEvent.press(screen.getByRole('button', { name: 'Open the GetReady Shop' }));
  expect(mockNavigate).toHaveBeenCalledWith('/customer/shop');
  await fireEvent.press(screen.getByRole('button', { name: 'Messages' }));
  expect(mockPush).toHaveBeenCalledWith('/customer/messages');
});

it('shows the error state when artists cannot load', async () => {
  serve(500);
  await wrap(<CustomerHome />);

  expect(await screen.findByRole('button', { name: 'Try again' })).toBeTruthy();
  expect(screen.queryByLabelText('Top rated artists')).toBeNull();
});

it('on landing, finds the customer from the phone and lists artists within the radius around their area', async () => {
  mockPosition.mockResolvedValue({ latitude: 12.917, longitude: 77.61 });
  serve();
  await wrap(<CustomerHome />);

  expect(await screen.findByRole('button', { name: 'Location: BTM Layout, Bangalore. Change' })).toBeTruthy();
  expect(await screen.findByText('Artists within 5 km of BTM Layout, Bangalore')).toBeTruthy();
  const nearby = paths.filter((p) => p.startsWith('/artists') && p.includes('near_lat=12.917'));
  expect(nearby.length).toBeGreaterThan(0);
  expect(nearby[0]).toContain('sort=nearest');
  expect(nearby[0]).not.toContain('city=');
});

it('when location is refused, says so and lets the customer search their area instead', async () => {
  serve();
  await wrap(<CustomerHome />);

  expect(await screen.findByText(/Allow location access in Settings, or search your area/)).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Search your area' }));
  await fireEvent.changeText(await screen.findByLabelText('Search your area'), 'btm');
  await fireEvent.press(await screen.findByRole('button', { name: 'BTM Layout, Bangalore' }, { timeout: 2000 }));

  expect(await screen.findByRole('button', { name: 'Location: BTM Layout, Bangalore. Change' })).toBeTruthy();
  await waitFor(() => expect(paths.some((p) => p.startsWith('/artists') && p.includes('near_lat=12.9166'))).toBe(true));
});

it('a permanent refusal offers Settings', async () => {
  mockPosition.mockRejectedValue(new LocationError('blocked'));
  serve();
  await wrap(<CustomerHome />);

  expect(await screen.findByRole('button', { name: 'Open Settings' })).toBeTruthy();
});
