import type { ReactElement } from 'react';
import { Alert } from 'react-native';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '../../core/theme/theme-provider';
import { transport } from '../../core/api/client';
import { currentToast, dismissToast } from '../../core/toast/toast';
import { DeleteAccountButton } from '../../components/auth/DeleteAccountButton';

const mockSignOut = jest.fn(async () => undefined);
jest.mock('../../context/auth/auth-provider', () => ({
  useAuth: () => ({ user: jest.requireActual('../../mocks/auth/auth').userFixture, signOut: mockSignOut }),
}));

type AlertButton = { text?: string; onPress?: () => void };
const send = jest.spyOn(transport, 'request');
const alert = jest.spyOn(Alert, 'alert');
let client: QueryClient;
const wrap = (ui: ReactElement) => render(<QueryClientProvider client={client}><ThemeProvider>{ui}</ThemeProvider></QueryClientProvider>);
/** Presses the dialog button labelled `text` in the most recent Alert. */
const choose = (text: string) => (alert.mock.calls.at(-1)?.[2] as AlertButton[]).find((b) => b.text === text)?.onPress?.();

beforeEach(() => {
  client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  send.mockReset();
  alert.mockReset();
  mockSignOut.mockClear();
  dismissToast();
});
afterEach(() => { client.clear(); dismissToast(); }); // dismissToast also clears the 4s auto-dismiss timer
afterAll(() => { send.mockRestore(); alert.mockRestore(); });

it('asks first, deletes the account on the server, then signs out', async () => {
  send.mockResolvedValue({ status: 204, json: null });
  await wrap(<DeleteAccountButton />);

  await fireEvent.press(screen.getByRole('button', { name: 'Delete account' }));
  expect(alert.mock.calls[0][0]).toBe('Delete your account?');
  expect(send).not.toHaveBeenCalled();
  choose('Delete account');

  await waitFor(() => expect(mockSignOut).toHaveBeenCalled());
  expect(send.mock.calls[0][0]).toMatchObject({ method: 'DELETE', path: '/users/me' });
});

it('keeps the account when the person backs out', async () => {
  await wrap(<DeleteAccountButton />);
  await fireEvent.press(screen.getByRole('button', { name: 'Delete account' }));
  choose('Keep account');
  expect(send).not.toHaveBeenCalled();
});

it('stays signed in and says why when deletion fails', async () => {
  send.mockResolvedValue({ status: 503, json: { code: 'service_unavailable', message: 'Try again in a minute' } });
  await wrap(<DeleteAccountButton />);
  await fireEvent.press(screen.getByRole('button', { name: 'Delete account' }));
  choose('Delete account');

  await waitFor(() => expect(currentToast()).toMatchObject({ tone: 'error', title: 'Couldn’t delete your account', body: 'Try again in a minute' }));
  expect(mockSignOut).not.toHaveBeenCalled();
});
