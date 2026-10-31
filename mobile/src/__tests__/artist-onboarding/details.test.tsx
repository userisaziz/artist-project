import type { ReactElement } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '../../core/theme/theme-provider';
import { transport } from '../../core/api/client';
import type { TransportRequest } from '../../core/api/transport';
import { artistProfileFixture } from '../../mocks/artist-onboarding/artist-onboarding';
import { userFixture } from '../../mocks/auth/auth';
import UpdateDetails from '../../../app/artist/details';

const mockBack = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ back: mockBack }) }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('../../context/auth/auth-provider', () => ({
  useAuth: () => ({ user: jest.requireActual('../../mocks/auth/auth').userFixture }),
}));

const send = jest.spyOn(transport, 'request');
const profileKey = ['artist', 'me', userFixture.id];
const approved = artistProfileFixture({ status: 'approved', experience_years: null, languages: [] });
let client: QueryClient;
const wrap = (ui: ReactElement) => render(<QueryClientProvider client={client}><ThemeProvider>{ui}</ThemeProvider></QueryClientProvider>);

beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity }, mutations: { retry: false } } });
  client.setQueryData(profileKey, approved);
  send.mockReset();
  mockBack.mockReset();
});
afterEach(() => client.clear());
afterAll(() => send.mockRestore());

it('an approved artist adds experience and languages, saved without a new review', async () => {
  send.mockImplementation(async (req: TransportRequest) => ({ status: 200, json: { ...approved, ...(req.body as object) } }));
  await wrap(<UpdateDetails />);

  await fireEvent.changeText(screen.getByLabelText('Years of experience'), '61');
  await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
  expect(screen.getByText(/number from 0 to 60/)).toBeTruthy();
  expect(send).not.toHaveBeenCalled();

  await fireEvent.changeText(screen.getByLabelText('Years of experience'), '8');
  await fireEvent.press(screen.getByRole('button', { name: /^Languages you speak/ }));
  await fireEvent.press(screen.getByRole('checkbox', { name: 'Hindi' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Done' })); // the sheet covers Save until it is shut
  await fireEvent.press(screen.getByRole('button', { name: 'Save' }));

  await waitFor(() => expect(mockBack).toHaveBeenCalled());
  expect(send.mock.calls[0][0]).toMatchObject({ method: 'PATCH', path: '/artists/me/details', body: { experience_years: 8, languages: ['Hindi'] } });
  expect(client.getQueryData(profileKey)).toMatchObject({ experience_years: 8, languages: ['Hindi'] });
});

it('shows the server error and stays put when saving fails', async () => {
  send.mockResolvedValue({ status: 409, json: { code: 'conflict', message: 'Profile is suspended and can’t be edited' } });
  await wrap(<UpdateDetails />);

  await fireEvent.changeText(screen.getByLabelText('Years of experience'), '5');
  await fireEvent.press(screen.getByRole('button', { name: 'Save' }));

  expect(await screen.findByText('Profile is suspended and can’t be edited')).toBeTruthy();
  expect(mockBack).not.toHaveBeenCalled();
});
