import { renderRouter, screen, waitFor, fireEvent } from 'expo-router/testing-library';
import * as SecureStore from 'expo-secure-store';

jest.mock('expo-secure-store', () => {
  const store = new Map<string, string>();
  return {
    setItemAsync: (k: string, v: string) => Promise.resolve(store.set(k, v)),
    getItemAsync: (k: string) => Promise.resolve(store.get(k) ?? null),
    deleteItemAsync: (k: string) => Promise.resolve(store.delete(k)),
    __store: store,
  };
});

const store = (SecureStore as unknown as { __store: Map<string, string> }).__store;

let logSpy: jest.SpyInstance;
beforeEach(() => {
  store.clear();
  logSpy = jest.spyOn(console, 'log').mockImplementation(() => {}); // mock transport logs every OTP
});
afterEach(() => {
  logSpy.mockRestore();
});

it('login → OTP (mock code) → home → sign out, against the real app routes', async () => {
  await renderRouter('./app');

  // (a) unauthenticated start lands on login
  expect(await screen.findByText('Welcome back')).toBeTruthy();

  // (b) valid number + Continue → OTP screen with the mock banner
  await fireEvent.changeText(screen.getByTestId('phone-national'), '9845012345');
  await fireEvent.press(screen.getByText('Continue'));
  expect(await screen.findByText('Enter the code')).toBeTruthy();
  expect(screen.getByText(/\+91 98450 12345/)).toBeTruthy();
  const banner = await screen.findByText(/^Mock mode: your code is \d{6}$/);
  const code = String(banner.props.children).match(/\d{6}/)![0];

  // (c) entering the code auto-submits and the gate moves to home
  await fireEvent.changeText(screen.getByTestId('otp-box-0'), code);
  expect(await screen.findByText('Welcome, +919845012345')).toBeTruthy();
  expect(screen.getByText('Customer')).toBeTruthy();
  expect(screen.queryByText('Enter the code')).toBeNull();

  // (d) sign out returns to login and clears the stored session
  await fireEvent.press(screen.getByText('Sign out'));
  expect(await screen.findByText('Welcome back')).toBeTruthy();
  await waitFor(() => expect(store.size).toBe(0));
});
