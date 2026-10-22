import type { ReactElement } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '../../core/theme/theme-provider';
import { transport } from '../../core/api/client';
import type { TransportRequest } from '../../core/api/transport';
import { parseQuery } from '../../core/api/query-string';
import { artistProfileFixture } from '../../mocks/artist-onboarding/artist-onboarding';
import { userFixture } from '../../mocks/auth/auth';
import type { Area } from '../../types/catalog/catalog';
import LocationStep from '../../../app/artist/onboarding/location';
import UpdateLocation from '../../../app/artist/location';

const mockPush = jest.fn();
const mockBack = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush, dismissTo: jest.fn(), back: mockBack }) }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
const mockPosition = jest.fn();
const mockPlaceAt = jest.fn();
jest.mock('../../core/location/location', () => ({
  ...jest.requireActual('../../core/location/location'),
  currentPosition: () => mockPosition(),
  placeAt: (coords: unknown) => mockPlaceAt(coords),
}));
// Native maps can't render under jest; the sheet confirms wherever the map opened.
jest.mock('../../components/common/PinMap', () => ({ PinMap: () => null }));
jest.mock('../../context/auth/auth-provider', () => ({
  useAuth: () => ({ user: jest.requireActual('../../mocks/auth/auth').userFixture }),
}));
jest.setTimeout(20_000);

// Mirrors backend GET /areas (app/catalog/schemas.py).
const BANER: Area = { id: 3, city: 'Pune', name: 'Baner', latitude: 18.559, longitude: 73.7868 };
const AUNDH: Area = { id: 4, city: 'Pune', name: 'Aundh', latitude: 18.5603, longitude: 73.8077 };
const KORAMANGALA: Area = { id: 1, city: 'Bangalore', name: 'Koramangala', latitude: 12.9352, longitude: 77.6245 };
const AREAS: Record<string, Area[]> = { Pune: [AUNDH, BANER], Bangalore: [KORAMANGALA] };

const send = jest.spyOn(transport, 'request');
const profileKey = ['artist', 'me', userFixture.id];
const draft = artistProfileFixture({ status: 'draft', city: 'Pune', area_id: null, locality: null, pincode: null, address_line: null });
let client: QueryClient;
const wrap = (ui: ReactElement) => render(<QueryClientProvider client={client}><ThemeProvider>{ui}</ThemeProvider></QueryClientProvider>);
const saves = () => send.mock.calls.map(([r]) => r).filter((r) => r.method === 'PUT' && r.path === '/artists/me/location');

/** GET /areas and /areas/nearest from the catalog; PUT /artists/me/location answers with `save`. */
function serve(save: (req: TransportRequest) => { status: number; json: unknown }, nearest: Area | null = KORAMANGALA) {
  send.mockImplementation(async (req: TransportRequest) => {
    const { path, query } = parseQuery(req.path);
    if (path === '/areas') return { status: 200, json: AREAS[query.city] ?? [] };
    if (path === '/areas/nearest') return { status: 200, json: nearest };
    if (req.method === 'PUT' && path === '/artists/me/location') return save(req);
    throw new Error(`unexpected request ${req.method} ${req.path}`);
  });
}
const saved = (req: TransportRequest) => ({ status: 200, json: { ...draft, ...(req.body as object) } });

beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity }, mutations: { retry: false } } });
  client.setQueryData(profileKey, draft);
  send.mockReset();
  mockPush.mockReset();
  mockBack.mockReset();
  mockPosition.mockReset();
  mockPlaceAt.mockReset();
});
afterEach(() => client.clear());
afterAll(() => send.mockRestore());

it('picks the area from the city’s list, then saves it with the pincode and studio no.', async () => {
  serve(saved);
  await wrap(<LocationStep />);

  const cont = screen.getByRole('button', { name: 'Continue' });
  await fireEvent.press(await screen.findByRole('button', { name: 'Choose your area' }));
  await fireEvent.changeText(screen.getByLabelText('Search area'), 'ban');
  expect(screen.queryByRole('button', { name: 'Aundh' })).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'Baner' }));
  expect(screen.getByRole('button', { name: 'Area: Baner. Change area' })).toBeTruthy();

  await fireEvent.changeText(screen.getByLabelText('Pincode'), '01104');
  await fireEvent.press(cont);
  expect(saves()).toHaveLength(0); // a five-digit pincode starting with 0 is not valid

  await fireEvent.changeText(screen.getByLabelText('Pincode'), '411045');
  await fireEvent.changeText(screen.getByLabelText('Studio / house no. (optional)'), '2nd floor, 14');
  await fireEvent.press(cont);

  await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/artist/onboarding/services'));
  expect(saves()[0].body).toEqual({ area_id: 3, pincode: '411045', address_line: '2nd floor, 14', latitude: null, longitude: null });
});

it('confirms the phone’s position on the map, then fills the area and pincode from the pin', async () => {
  mockPosition.mockResolvedValue({ latitude: 12.9352, longitude: 77.6245 });
  mockPlaceAt.mockResolvedValue({ coords: { latitude: 12.9352, longitude: 77.6245 }, locality: null, pincode: '560095', city: 'Bengaluru' });
  serve(saved);
  await wrap(<LocationStep />);

  await fireEvent.press(screen.getByRole('button', { name: 'Use my current location' }));
  expect(await screen.findByText('Confirm your studio location')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Confirm location' }));

  expect(await screen.findByRole('button', { name: 'Area: Koramangala. Change area' })).toBeTruthy();
  await waitFor(() => expect(screen.getByLabelText('Pincode').props.value).toBe('560095'));
  expect(screen.getByText('Area in Bangalore')).toBeTruthy(); // the pin's area decides the city
  await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));

  await waitFor(() => expect(saves()).toHaveLength(1));
  expect(saves()[0].body).toMatchObject({ area_id: 1, pincode: '560095', latitude: 12.9352, longitude: 77.6245 });
});

it('a pin outside every area asks for one from the list; a refused permission keeps the list', async () => {
  mockPosition.mockResolvedValueOnce({ latitude: 10, longitude: 70 });
  mockPlaceAt.mockResolvedValue({ coords: { latitude: 10, longitude: 70 }, locality: null, pincode: null, city: null });
  serve(saved, null);
  await wrap(<LocationStep />);

  await fireEvent.press(screen.getByRole('button', { name: 'Use my current location' }));
  await fireEvent.press(await screen.findByRole('button', { name: 'Confirm location' }));
  expect(await screen.findByText(/couldn’t match your pin to an area/)).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Choose your area' })).toBeTruthy();

  const { LocationError } = jest.requireActual('../../core/location/location');
  mockPosition.mockRejectedValueOnce(new LocationError('denied'));
  await fireEvent.press(screen.getByRole('button', { name: 'Change location' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Use my current location' }));
  expect(await screen.findByText(/Allow location access in Settings/)).toBeTruthy();
});

it('shows the server error and stays on the step when saving fails', async () => {
  serve(() => ({ status: 422, json: { code: 'validation_error', message: 'Unknown area' } }));
  await wrap(<LocationStep />);

  await fireEvent.press(await screen.findByRole('button', { name: 'Choose your area' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Baner' }));
  await fireEvent.changeText(screen.getByLabelText('Pincode'), '411045');
  await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));

  expect(await screen.findByText('Unknown area')).toBeTruthy();
  expect(mockPush).not.toHaveBeenCalled();
});

it('an approved artist keeps their area, changes the pincode from Me and goes back', async () => {
  client.setQueryData(profileKey, { ...draft, status: 'approved', area_id: 3, locality: 'Baner', pincode: '411045' });
  serve((req) => ({ status: 200, json: { ...draft, status: 'approved', ...(req.body as object) } }));
  await wrap(<UpdateLocation />);

  expect(screen.getByText('YOUR LOCATION')).toBeTruthy();
  expect(await screen.findByRole('button', { name: 'Area: Baner. Change area' })).toBeTruthy();
  await fireEvent.changeText(screen.getByLabelText('Pincode'), '411021');
  await fireEvent.press(screen.getByRole('button', { name: 'Save location' }));

  await waitFor(() => expect(mockBack).toHaveBeenCalled());
  expect(saves()[0].body).toMatchObject({ area_id: 3, pincode: '411021' });
  expect(mockPush).not.toHaveBeenCalled();
});
