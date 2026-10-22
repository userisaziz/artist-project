import type { ReactElement } from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '../../core/theme/theme-provider';
import { transport } from '../../core/api/client';
import { ServiceDetail } from '../../components/directory/ServiceDetail';
import type { ArtistPublic } from '../../types/directory/directory';

jest.mock('expo-router', () => ({ useRouter: () => ({ back: jest.fn(), push: jest.fn() }), useIsFocused: () => true }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));

// Mirrors backend GET /artists/{id} (app/directory/schemas.py).
const artist: ArtistPublic = {
  id: 'a1', business_name: 'Ayesha Mehendi Art', city: 'Bangalore', photo_url: null, cover_url: null,
  categories: [{ id: 1, name: 'Mehendi' }], from_price_paise: 350000, rating: 4.9, review_count: 86,
  bio: null, photos: [{ id: 'ph1', url: 'https://fake.storage/full/hands.jpg', thumb_url: 'https://fake.storage/thumb/hands.jpg' }],
  services: [{
    id: 's1', name: 'Bridal Mehendi', description: 'Hands and feet, a custom design and a consultation call.',
    price_paise: 350000, duration_minutes: 210, category: { id: 1, name: 'Mehendi' }, subcategory: { id: 2, name: 'Bridal' },
    booking_count: 0,
    included_items: ['Bridal hands', 'Bridal feet'],
    addons: [
      { id: 'ad1', name: 'Guest mehendi', price_paise: 50000, per_person: true },
      { id: 'ad2', name: 'Organic henna upgrade', price_paise: 40000, per_person: false },
    ],
  }],
} as ArtistPublic;

const send = jest.spyOn(transport, 'request');
let client: QueryClient;
const wrap = (ui: ReactElement) => render(<QueryClientProvider client={client}><ThemeProvider>{ui}</ThemeProvider></QueryClientProvider>);

beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  send.mockReset();
});
afterEach(() => client.clear());
afterAll(() => send.mockRestore());

it('shows the service with its price, duration and artist, and opens Date & time', async () => {
  send.mockResolvedValue({ status: 200, json: artist });
  const onCheck = jest.fn();
  await wrap(<ServiceDetail artistId="a1" serviceId="s1" onCheckAvailability={onCheck} />);

  expect(await screen.findByRole('header', { name: 'Bridal Mehendi' })).toBeTruthy();
  expect(screen.getByText('Mehendi · Bridal')).toBeTruthy();
  expect(screen.getByText('4.9 (86)')).toBeTruthy();
  expect(screen.getAllByText('₹3,500')).toHaveLength(2); // "Starting at" and the estimate
  expect(screen.getByText('Hands and feet, a custom design and a consultation call.')).toBeTruthy();

  await fireEvent.press(screen.getByText('Check availability'));
  expect(onCheck).toHaveBeenCalledWith(expect.objectContaining({ id: 's1' }), []);
});

it('lists what is included, and prices the add-ons the customer picks', async () => {
  send.mockResolvedValue({ status: 200, json: artist });
  const onCheck = jest.fn();
  await wrap(<ServiceDetail artistId="a1" serviceId="s1" onCheckAvailability={onCheck} />);

  expect(await screen.findByText('Bridal hands')).toBeTruthy();
  expect(screen.getByText('Bridal feet')).toBeTruthy();
  expect(screen.getByLabelText('Estimate ₹3,500')).toBeTruthy();

  await fireEvent.press(screen.getByRole('checkbox', { name: /Guest mehendi/ }));
  for (let i = 0; i < 3; i += 1) await fireEvent.press(screen.getByRole('button', { name: 'More guests for Guest mehendi' }));
  await fireEvent.press(screen.getByRole('checkbox', { name: /Organic henna upgrade/ }));
  expect(screen.getByText('4 guests')).toBeTruthy();
  expect(screen.getByLabelText('Estimate ₹5,900')).toBeTruthy(); // ₹3,500 + 4 × ₹500 + ₹400

  await fireEvent.press(screen.getByRole('checkbox', { name: /Organic henna upgrade/ }));
  await fireEvent.press(screen.getByText('Check availability'));
  expect(onCheck).toHaveBeenCalledWith(expect.objectContaining({ id: 's1' }), [{ addon_id: 'ad1', guests: 4 }]);
});

it('says so when the service is no longer offered', async () => {
  send.mockResolvedValue({ status: 200, json: { ...artist, services: [] } });
  await wrap(<ServiceDetail artistId="a1" serviceId="s1" onCheckAvailability={jest.fn()} />);

  expect(await screen.findByText('This service is no longer offered.')).toBeTruthy();
});

it('shows an error with a retry when the artist can’t load', async () => {
  send.mockResolvedValue({ status: 503, json: { code: 'service_unavailable', message: 'Service temporarily unavailable. Please try again.' } });
  await wrap(<ServiceDetail artistId="a1" serviceId="s1" onCheckAvailability={jest.fn()} />);

  expect(await screen.findByText('Service temporarily unavailable. Please try again.')).toBeTruthy();
});
