import type { ReactElement, ReactNode } from 'react';
import { Alert } from 'react-native';
import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '../../core/theme/theme-provider';
import { transport } from '../../core/api/client';
import type { TransportRequest } from '../../core/api/transport';
import { useAddressBook } from '../../hooks/addresses/addresses';
import { SavedAddresses } from '../../components/addresses/SavedAddresses';
import type { SavedAddress } from '../../types/addresses/addresses';

jest.mock('../../context/auth/auth-provider', () => ({
  useAuth: () => ({ user: jest.requireActual('../../mocks/auth/auth').userFixture }),
}));
jest.mock('expo-router', () => ({ useRouter: () => ({ back: jest.fn(), push: jest.fn() }) }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));

// Mirrors backend Address (app/user).
const home: SavedAddress = { id: 'ad-1', label: 'Home', address: '12 Residency Rd, Bangalore 560025', created_at: '2026-10-01T10:00:00Z', last_used_at: null };

const send = jest.spyOn(transport, 'request');
const alert = jest.spyOn(Alert, 'alert');
const sent: string[] = [];
const bodies: unknown[] = [];
let list: SavedAddress[];
let client: QueryClient;
const Providers = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}><ThemeProvider>{children}</ThemeProvider></QueryClientProvider>;
const wrap = (ui: ReactElement) => render(<Providers>{ui}</Providers>);

beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  sent.length = 0;
  bodies.length = 0;
  list = [home];
  send.mockReset();
  alert.mockReset();
  send.mockImplementation(async (req: TransportRequest) => {
    sent.push(`${req.method} ${req.path}`);
    if (req.body !== undefined) bodies.push(req.body);
    if (req.method === 'GET') return { status: 200, json: list };
    if (req.method === 'POST' && req.path === '/users/me/addresses') {
      const created = { ...home, id: 'ad-2', ...(req.body as object) };
      list = [...list, created];
      return { status: 201, json: created };
    }
    if (req.method === 'DELETE') { list = []; return { status: 204, json: null }; }
    return { status: 204, json: null };
  });
});
afterEach(() => client.clear());
afterAll(() => { send.mockRestore(); alert.mockRestore(); });

it('after a booking, a picked address is marked used and a new one is saved only when asked', async () => {
  const { result } = await renderHook(() => useAddressBook(), { wrapper: Providers });
  await waitFor(() => expect(result.current.choices).toEqual([{ id: 'ad-1', label: 'Home', address: home.address }]));

  await act(async () => { result.current.afterUse(home.address, 'ad-1', true); });
  await act(async () => { result.current.afterUse('  Flat 4, Indiranagar, Bangalore  ', null, false); });
  await act(async () => { result.current.afterUse('Flat 4, Indiranagar, Bangalore', null, true); });

  await waitFor(() => expect(sent).toContain('POST /users/me/addresses'));
  expect(sent).toContain('POST /users/me/addresses/ad-1/used');
  expect(sent.filter((s) => s === 'POST /users/me/addresses')).toHaveLength(1);
  expect(bodies).toContainEqual({ label: 'Other', address: 'Flat 4, Indiranagar, Bangalore' });
});

it('Saved addresses adds one and deletes one after asking', async () => {
  await wrap(<SavedAddresses />);
  expect(await screen.findByText(home.address)).toBeTruthy();

  await fireEvent.changeText(screen.getByLabelText('Label (e.g. Home, Work)'), 'Work');
  await fireEvent.changeText(screen.getByLabelText('Address'), 'WeWork, MG Road, Bangalore');
  await fireEvent.press(screen.getByRole('button', { name: 'Save address' }));
  expect(await screen.findByText('WeWork, MG Road, Bangalore')).toBeTruthy();

  await fireEvent.press(screen.getByRole('button', { name: 'Delete Home' }));
  expect(alert.mock.calls[0][0]).toBe('Delete “Home”?');
  (alert.mock.calls[0][2] as { text?: string; onPress?: () => void }[]).find((b) => b.text === 'Delete')?.onPress?.();
  expect(await screen.findByText('No saved addresses yet. Add one here, or save it when you book.')).toBeTruthy();
  expect(sent).toContain('DELETE /users/me/addresses/ad-1');
});

it('Saved addresses offers a retry when they cannot load', async () => {
  send.mockImplementation(async () => ({ status: 503, json: { code: 'service_unavailable', message: 'Try again in a minute' } }));
  await wrap(<SavedAddresses />);
  expect(await screen.findByText('Try again in a minute')).toBeTruthy();
});
