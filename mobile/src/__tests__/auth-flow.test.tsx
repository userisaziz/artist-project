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

it('new user: login → OTP → sign-up → Choose role → customer home → sign out, against the real app routes', async () => {
  await renderRouter('./app');

  // (a) unauthenticated start lands on welcome; Get started opens login
  expect(await screen.findByText('Get started')).toBeTruthy();
  expect(screen.getByTestId('welcome-hero')).toBeTruthy();
  await fireEvent.press(screen.getByText('Get started'));
  expect(await screen.findByText('Your number.')).toBeTruthy();

  // (b) valid number + Continue → OTP screen with the mock banner
  await fireEvent.changeText(screen.getByTestId('phone-national'), '9845012345');
  await fireEvent.press(screen.getByText('Send code'));
  expect(await screen.findByText('Enter the code.')).toBeTruthy();
  expect(screen.getByText(/\+91 98450 12345/)).toBeTruthy();
  const banner = await screen.findByText(/^Mock mode: your code is \d{6}$/);
  const code = String(banner.props.children).match(/\d{6}/)![0];

  // (c) entering the code auto-submits; a new number lands on sign-up, then Choose role
  await fireEvent.changeText(screen.getByTestId('otp-box-0'), code);
  expect(await screen.findByText('What’s your name?')).toBeTruthy();
  expect(screen.queryByText('Enter the code.')).toBeNull();
  expect(screen.getByLabelText('Step 3 of 3')).toBeTruthy();
  await fireEvent.changeText(screen.getByLabelText('First name'), 'Ananya');
  await fireEvent.press(screen.getByText('Continue'));
  expect(await screen.findByText('What brings you here?')).toBeTruthy();

  // (c2) "Browse artists" makes them a customer and the gate moves to the customer home
  await fireEvent.press(screen.getByText('Browse artists'));
  expect(await screen.findByText('Welcome, Ananya')).toBeTruthy();
  expect(screen.getByText('Customer')).toBeTruthy();

  // (d) sign out returns to welcome and clears the stored session
  await fireEvent.press(screen.getByText('Sign out'));
  expect(await screen.findByText('Get started')).toBeTruthy();
  await waitFor(() => expect(store.size).toBe(0));
});

it('"I already have an account" also opens login, and its back button returns to welcome', async () => {
  await renderRouter('./app');
  await fireEvent.press(await screen.findByText('I already have an account'));
  expect(await screen.findByText('Your number.')).toBeTruthy();
  expect(screen.getByText('We’ll text you a code. No passwords.')).toBeTruthy();
  expect(screen.getByLabelText('Step 1 of 3')).toBeTruthy();
  await fireEvent.press(screen.getByLabelText('Back'));
  expect(await screen.findByText('Get started')).toBeTruthy();
});

it('wrong code shows "That code is incorrect." and stays on the OTP screen', async () => {
  await renderRouter('./app');
  await fireEvent.press(await screen.findByText('Get started'));
  expect(await screen.findByText('Your number.')).toBeTruthy();

  await fireEvent.changeText(screen.getByTestId('phone-national'), '9845099999'); // own phone: mock cooldown is per-number
  await fireEvent.press(screen.getByText('Send code'));
  const banner = await screen.findByText(/^Mock mode: your code is \d{6}$/);
  const code = String(banner.props.children).match(/\d{6}/)![0];
  const wrong = code === '000000' ? '111111' : '000000';

  await fireEvent.changeText(screen.getByTestId('otp-box-0'), wrong);
  expect(await screen.findByText('That code is incorrect.')).toBeTruthy();
  expect(screen.getByText('Enter the code.')).toBeTruthy();
  expect(screen.queryByText(/^Welcome, /)).toBeNull();

  // typing the next attempt clears the stale error
  await fireEvent.changeText(screen.getByTestId('otp-box-0'), '1');
  await waitFor(() => expect(screen.queryByText('That code is incorrect.')).toBeNull());
});

it('non-auth verify failure shows the generic message and keeps the digits (no shake/clear)', async () => {
  await renderRouter('./app');
  await fireEvent.press(await screen.findByText('Get started'));
  expect(await screen.findByText('Your number.')).toBeTruthy();

  await fireEvent.changeText(screen.getByTestId('phone-national'), '9845088888');
  await fireEvent.press(screen.getByText('Send code'));
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

it('OTP shows the resend countdown, and Edit returns to the number screen', async () => {
  await renderRouter('./app');
  await fireEvent.press(await screen.findByText('Get started'));
  await fireEvent.changeText(await screen.findByTestId('phone-national'), '9845077777');
  await fireEvent.press(screen.getByText('Send code'));
  expect(await screen.findByText('Enter the code.')).toBeTruthy();
  expect(screen.getByText(/^Resend in 0:\d\d$/)).toBeTruthy();
  await fireEvent.press(screen.getByText('Edit'));
  expect(await screen.findByText('Your number.')).toBeTruthy();
});


/** Welcome → Log in → OTP with the mock code; leaves the app wherever the gate sends this user. */
async function signInAs(national: string) {
  await renderRouter('./app');
  await fireEvent.press(await screen.findByText('Get started'));
  await fireEvent.changeText(await screen.findByTestId('phone-national'), national);
  await fireEvent.press(screen.getByText('Send code'));
  const banner = await screen.findByText(/^Mock mode: your code is \d{6}$/);
  await fireEvent.changeText(screen.getByTestId('otp-box-0'), String(banner.props.children).match(/\d{6}/)![0]);
}

it('"Create your profile" on the artist card onboards them as an artist', async () => {
  await signInAs('9845066666');
  await fireEvent.changeText(await screen.findByLabelText('First name'), 'Riya');
  await fireEvent.press(screen.getByText('Continue'));
  await fireEvent.press(await screen.findByText('Create your profile'));
  expect(await screen.findByText('Turn your craft into bookings')).toBeTruthy();
});

it('sign-up needs a name and rejects a malformed email', async () => {
  await signInAs('9845055555');
  expect(await screen.findByText('What’s your name?')).toBeTruthy();
  await fireEvent.press(screen.getByText('Continue'));
  expect(screen.queryByText('What brings you here?')).toBeNull(); // disabled without a name
  await fireEvent.changeText(screen.getByLabelText('First name'), 'Meera');
  await fireEvent.changeText(screen.getByLabelText('Email (optional)'), 'meera@');
  await fireEvent.press(screen.getByText('Continue'));
  expect(await screen.findByText('Enter a valid email, or leave it empty.')).toBeTruthy();
});

it('a returning artist skips sign-up and role and lands on the artist home', async () => {
  await renderRouter('./app');
  await fireEvent.press(await screen.findByText('Get started'));
  await fireEvent.press(await screen.findByLabelText('Country code +91'));
  await fireEvent.press(await screen.findByText('USA / Canada'));
  await fireEvent.changeText(screen.getByTestId('phone-national'), '5550009999'); // mock's seeded artist
  await fireEvent.press(screen.getByText('Send code'));
  const banner = await screen.findByText(/^Mock mode: your code is \d{6}$/);
  await fireEvent.changeText(screen.getByTestId('otp-box-0'), String(banner.props.children).match(/\d{6}/)![0]);
  expect(await screen.findByText('Welcome, Priya')).toBeTruthy();
  expect(screen.getByText('Artist')).toBeTruthy();
});
