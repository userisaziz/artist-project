import { renderRouter, screen, waitFor, fireEvent } from 'expo-router/testing-library';
import * as SecureStore from 'expo-secure-store';
import { transport } from '../api/client';

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

  // (a) unauthenticated start lands on welcome; Get started opens login
  expect(await screen.findByText('Get started')).toBeTruthy();
  expect(screen.getByTestId('welcome-hero')).toBeTruthy();
  await fireEvent.press(screen.getByText('Get started'));
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

  // (d) sign out returns to welcome and clears the stored session
  await fireEvent.press(screen.getByText('Sign out'));
  expect(await screen.findByText('Get started')).toBeTruthy();
  await waitFor(() => expect(store.size).toBe(0));
});

it('"I already have an account" also opens login', async () => {
  await renderRouter('./app');
  await fireEvent.press(await screen.findByText('I already have an account'));
  expect(await screen.findByText('Welcome back')).toBeTruthy();
});

it('wrong code shows "That code is incorrect." and stays on the OTP screen', async () => {
  await renderRouter('./app');
  await fireEvent.press(await screen.findByText('Get started'));
  expect(await screen.findByText('Welcome back')).toBeTruthy();

  await fireEvent.changeText(screen.getByTestId('phone-national'), '9845099999'); // own phone: mock cooldown is per-number
  await fireEvent.press(screen.getByText('Continue'));
  const banner = await screen.findByText(/^Mock mode: your code is \d{6}$/);
  const code = String(banner.props.children).match(/\d{6}/)![0];
  const wrong = code === '000000' ? '111111' : '000000';

  await fireEvent.changeText(screen.getByTestId('otp-box-0'), wrong);
  expect(await screen.findByText('That code is incorrect.')).toBeTruthy();
  expect(screen.getByText('Enter the code')).toBeTruthy();
  expect(screen.queryByText(/^Welcome, /)).toBeNull();
});

it('non-auth verify failure shows the generic message and keeps the digits (no shake/clear)', async () => {
  await renderRouter('./app');
  await fireEvent.press(await screen.findByText('Get started'));
  expect(await screen.findByText('Welcome back')).toBeTruthy();

  await fireEvent.changeText(screen.getByTestId('phone-national'), '9845088888');
  await fireEvent.press(screen.getByText('Continue'));
  const banner = await screen.findByText(/^Mock mode: your code is \d{6}$/);
  const code = String(banner.props.children).match(/\d{6}/)![0];

  const real = transport.request.bind(transport);
  const spy = jest.spyOn(transport, 'request').mockImplementation((r) =>
    r.path === '/auth/otp/verify' ? Promise.resolve({ status: 500, json: null }) : real(r));
  await fireEvent.changeText(screen.getByTestId('otp-box-0'), code);
  expect(await screen.findByText('Something went wrong. Please try again.')).toBeTruthy();
  expect(screen.queryByText('That code is incorrect.')).toBeNull();
  expect(screen.getByTestId('otp-box-5').props.value).toBe(code[5]); // digits kept for a retry via Verify
  spy.mockRestore();
});
