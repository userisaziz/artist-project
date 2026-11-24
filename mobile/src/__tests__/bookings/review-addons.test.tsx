import type { ReactElement } from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '../../core/theme/theme-provider';
import { transport } from '../../core/api/client';
import type { TransportRequest } from '../../core/api/transport';
import type { ArtistPublic } from '../../types/directory/directory';
import type { FieldDef } from '../../types/catalog/catalog';
import ReviewAndPay from '../../../app/customer/book/review';

const mockReplace = jest.fn();
const mockPush = jest.fn();
const mockSetParams = jest.fn();
const mockDismissTo = jest.fn();
const mockParams: Record<string, string> = { artistId: 'a1', serviceId: 's1', startAt: '2026-12-05T05:30:00Z', addons: 'ad1:4,ad2:1' };
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), push: mockPush, replace: mockReplace, setParams: mockSetParams, dismissTo: mockDismissTo }),
  useLocalSearchParams: () => mockParams,
}));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('../../context/auth/auth-provider', () => ({
  useAuth: () => ({ user: jest.requireActual('../../mocks/auth/auth').userFixture }),
}));

jest.setTimeout(20_000);

const BRIDE: FieldDef = { key: 'bride_name', label: "Bride's name", scope: 'booking', type: 'text', required: true, options: [], min: null, max: null, unit: null, help: null };
let service: Record<string, unknown> = {};

// Mirrors backend GET /artists/{id} (app/directory/schemas.py).
const artistWith = (over: Record<string, unknown>) => ({ ...artist, services: [{ ...artist.services[0], ...over }] });
const artist = {
  id: 'a1', business_name: 'Ayesha Mehendi Art', city: 'Bangalore', photo_url: null, cover_url: null,
  categories: [{ id: 1, name: 'Mehendi' }], from_price_paise: 350000, rating: 4.9, review_count: 86, bio: null, photos: [],
  services: [{
    id: 's1', name: 'Bridal Mehendi', description: null, price_paise: 350000, duration_minutes: 210,
    category: { id: 1, name: 'Mehendi' }, subcategory: { id: 2, name: 'Bridal' }, booking_count: 0, included_items: [],
    addons: [
      { id: 'ad1', name: 'Guest mehendi', price_paise: 50000, per_person: true },
      { id: 'ad2', name: 'Organic henna upgrade', price_paise: 40000, per_person: false },
    ],
    pricing_unit: 'package', quantity_unit: null, min_quantity: 1, fulfilment: 'appointment', details: [], booking_fields: [],
  }],
} as unknown as ArtistPublic;

const send = jest.spyOn(transport, 'request');
const bodies: unknown[] = [];
let client: QueryClient;
const wrap = (ui: ReactElement) => render(<QueryClientProvider client={client}><ThemeProvider>{ui}</ThemeProvider></QueryClientProvider>);

beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  send.mockReset();
  bodies.length = 0;
  mockReplace.mockReset();
  mockSetParams.mockReset();
  service = {};
  mockParams.addons = 'ad1:4,ad2:1';
  delete mockParams.qty;
  send.mockImplementation(async (req: TransportRequest) => {
    const path = req.path.split('?')[0];
    if (req.method === 'GET' && path === '/artists/a1') return { status: 200, json: artistWith(service) };
    if (req.method === 'POST' && path === '/bookings') { bodies.push(req.body); return { status: 201, json: { id: 'b1' } }; }
    if (path === '/users/me/addresses') return { status: 200, json: [] };
    return { status: 200, json: {} };
  });
});
afterEach(() => client.clear());
afterAll(() => send.mockRestore());

it('lists the package and each add-on like a cart, and a removed add-on leaves the total and the request', async () => {
  await wrap(<ReviewAndPay />);
  const summary = await screen.findByLabelText('Your booking');
  expect(within(summary).getByText('Bridal Mehendi')).toBeTruthy();
  expect(within(summary).getByText('+ Guest mehendi × 4 guests')).toBeTruthy();
  expect(within(summary).getByText('+ Organic henna upgrade')).toBeTruthy();
  expect(within(summary).getByText('₹5,900')).toBeTruthy(); // ₹3,500 + 4 × ₹500 + ₹400

  await fireEvent.press(screen.getByRole('button', { name: 'Remove Organic henna upgrade' }));
  expect(within(summary).queryByText('+ Organic henna upgrade')).toBeNull();
  expect(within(summary).getByText('₹5,500')).toBeTruthy();
  expect(mockSetParams).toHaveBeenLastCalledWith({ addons: 'ad1:4' });

  await fireEvent.changeText(screen.getByPlaceholderText('House, street and area'), '12 MG Road, Bangalore');
  await fireEvent.press(screen.getByRole('button', { name: 'Request booking' }));
  expect(bodies[0]).toMatchObject({ addons: [{ addon_id: 'ad1', guests: 4 }] });
});

it('adds an add-on from the review step', async () => {
  await wrap(<ReviewAndPay />);
  await fireEvent.press(await screen.findByRole('button', { name: 'Remove Guest mehendi × 4 guests' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Remove Organic henna upgrade' }));
  expect(screen.getByText('No add-ons picked.')).toBeTruthy();

  await fireEvent.press(screen.getByRole('button', { name: 'Add add-ons' }));
  await fireEvent.press(screen.getByRole('checkbox', { name: /Organic henna upgrade/ }));
  expect(screen.getByText('+ Organic henna upgrade')).toBeTruthy();
  expect(mockSetParams).toHaveBeenLastCalledWith({ addons: 'ad2:1' });
});

it('asks the service’s booking questions and sends the answers with the quantity, which stays editable', async () => {
  service = { pricing_unit: 'per_unit', quantity_unit: 'person', min_quantity: 2, price_paise: 30000, booking_fields: [BRIDE] };
  mockParams.addons = '';
  mockParams.qty = '3';
  await wrap(<ReviewAndPay />);
  const summary = await screen.findByLabelText('Your booking');
  expect(within(summary).getByText('Bridal Mehendi × 3 people')).toBeTruthy();
  expect(within(summary).getAllByText('₹900').length).toBeGreaterThan(0); // 3 × ₹300
  await fireEvent.press(screen.getByRole('button', { name: 'More people' }));
  expect(within(summary).getByText('Bridal Mehendi × 4 people')).toBeTruthy();
  expect(mockSetParams).toHaveBeenLastCalledWith({ qty: '4' });

  await fireEvent.changeText(screen.getByPlaceholderText('House, street and area'), '12 MG Road, Bangalore');
  await fireEvent.press(screen.getByRole('button', { name: 'Request booking' }));
  expect(await screen.findByText("“Bride's name” is required")).toBeTruthy();
  expect(bodies).toHaveLength(0);

  await fireEvent.changeText(screen.getByLabelText("Bride's name"), 'Sara');
  await fireEvent.press(screen.getByRole('button', { name: 'Request booking' }));
  await waitFor(() => expect(bodies[0]).toMatchObject({ quantity: 4, answers: { bride_name: 'Sara' } }));
});

it('suggests the artist’s other services, opening one on tap', async () => {
  const other = { ...artist.services[0], id: 's2', name: 'Arabic Mehendi', price_paise: 150000, addons: [] };
  send.mockImplementation(async (req: TransportRequest) => {
    if (req.path.split('?')[0] === '/artists/a1') return { status: 200, json: { ...artist, services: [artist.services[0], other] } };
    if (req.path === '/users/me/addresses') return { status: 200, json: [] };
    return { status: 200, json: {} };
  });
  await wrap(<ReviewAndPay />);
  expect(await screen.findByRole('header', { name: 'Goes well with' })).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Arabic Mehendi, ₹1,500' }));
  expect(mockPush).toHaveBeenCalledWith({ pathname: '/customer/artist/[id]/service/[serviceId]', params: { id: 'a1', serviceId: 's2' } });
});
