import type { ReactElement } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '../../core/theme/theme-provider';
import { transport } from '../../core/api/client';
import type { TransportRequest } from '../../core/api/transport';
import { artistProfileFixture } from '../../mocks/artist-onboarding/artist-onboarding';
import { userFixture } from '../../mocks/auth/auth';
import LocationStep from '../../../app/artist/onboarding/location';
import UpdateLocation from '../../../app/artist/location';

const mockPush = jest.fn();
const mockBack = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush, dismissTo: jest.fn(), back: mockBack }) }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
const mockCurrentPlace = jest.fn();
jest.mock('../../core/location/location', () => ({
  ...jest.requireActual('../../core/location/location'),
  currentPlace: () => mockCurrentPlace(),
}));
jest.mock('../../context/auth/auth-provider', () => ({
  useAuth: () => ({ user: jest.requireActual('../../mocks/auth/auth').userFixture }),
}));

const send = jest.spyOn(transport, 'request');
const profileKey = ['artist', 'me', userFixture.id];
const draft = artistProfileFixture({ status: 'draft', city: 'Pune', locality: null, pincode: null, address_line: null });
let client: QueryClient;
const wrap = (ui: ReactElement) => render(<QueryClientProvider client={client}><ThemeProvider>{ui}</ThemeProvider></QueryClientProvider>);

beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity }, mutations: { retry: false } } });
  client.setQueryData(profileKey, draft);
  send.mockReset();
  mockPush.mockReset();
  mockCurrentPlace.mockReset();
  mockBack.mockReset();
});
afterEach(() => client.clear());
afterAll(() => send.mockRestore());

it('saves the area, pincode and studio no., then goes on to Services', async () => {
  const saved = { ...draft, locality: 'Baner', pincode: '411045', address_line: '2nd floor, 14' };
  send.mockImplementation(async (req: TransportRequest) => {
    if (`${req.method} ${req.path}` !== 'PUT /artists/me/location') throw new Error(`unexpected request ${req.method} ${req.path}`);
    return { status: 200, json: saved };
  });
  await wrap(<LocationStep />);
  expect(screen.getByText(/Pune/)).toBeTruthy();

  const cont = screen.getByRole('button', { name: 'Continue' });
  await fireEvent.changeText(screen.getByLabelText('Area'), 'Baner');
  await fireEvent.changeText(screen.getByLabelText('Pincode'), '01104');
  await fireEvent.press(cont);
  expect(send).not.toHaveBeenCalled(); // a five-digit pincode starting with 0 is not valid

  await fireEvent.changeText(screen.getByLabelText('Pincode'), '411045');
  await fireEvent.changeText(screen.getByLabelText('Studio / house no. (optional)'), '2nd floor, 14');
  await fireEvent.press(cont);

  await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/artist/onboarding/services'));
  expect(send.mock.calls[0][0]).toMatchObject({ body: { locality: 'Baner', pincode: '411045', address_line: '2nd floor, 14' } });
  expect(client.getQueryData(profileKey)).toEqual(saved);
});

it('shows the server error and stays on the step when saving fails', async () => {
  send.mockResolvedValue({ status: 409, json: { code: 'conflict', message: 'Profile is pending and can’t be edited' } });
  await wrap(<LocationStep />);

  await fireEvent.changeText(screen.getByLabelText('Area'), 'Baner');
  await fireEvent.changeText(screen.getByLabelText('Pincode'), '411045');
  await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));

  expect(await screen.findByText('Profile is pending and can’t be edited')).toBeTruthy();
  expect(mockPush).not.toHaveBeenCalled();
});

it('fills the area and pincode from the phone and saves the pin with them', async () => {
  mockCurrentPlace.mockResolvedValue({
    coords: { latitude: 12.9352, longitude: 77.6245 }, locality: 'Koramangala 5th Block', pincode: '560095', city: 'Bengaluru',
  });
  send.mockImplementation(async (req: TransportRequest) => ({ status: 200, json: { ...draft, ...(req.body as object) } }));
  await wrap(<LocationStep />);

  await fireEvent.press(screen.getByRole('button', { name: 'Use my current location' }));

  expect(await screen.findByText('Koramangala 5th Block')).toBeTruthy();
  expect(screen.getByLabelText('Area').props.value).toBe('Koramangala 5th Block');
  expect(screen.getByLabelText('Pincode').props.value).toBe('560095');
  await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));

  await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/artist/onboarding/services'));
  expect(send.mock.calls[0][0]).toMatchObject({
    body: { locality: 'Koramangala 5th Block', pincode: '560095', latitude: 12.9352, longitude: 77.6245 },
  });
});

it('explains a refused permission and keeps manual entry open', async () => {
  const { LocationError } = jest.requireActual('../../core/location/location');
  mockCurrentPlace.mockRejectedValue(new LocationError('denied'));
  await wrap(<LocationStep />);

  await fireEvent.press(screen.getByRole('button', { name: 'Use my current location' }));

  expect(await screen.findByText(/Allow location access in Settings/)).toBeTruthy();
  expect(screen.getByLabelText('Area')).toBeTruthy();
});

it('an approved artist saves a location from Me and goes back, with no onboarding steps', async () => {
  client.setQueryData(profileKey, { ...draft, status: 'approved' });
  send.mockImplementation(async (req: TransportRequest) => ({ status: 200, json: { ...draft, status: 'approved', ...(req.body as object) } }));
  await wrap(<UpdateLocation />);

  expect(screen.getByText('YOUR LOCATION')).toBeTruthy();
  await fireEvent.changeText(screen.getByLabelText('Area'), 'Baner');
  await fireEvent.changeText(screen.getByLabelText('Pincode'), '411045');
  await fireEvent.press(screen.getByRole('button', { name: 'Save location' }));

  await waitFor(() => expect(mockBack).toHaveBeenCalled());
  expect(mockPush).not.toHaveBeenCalled();
});
