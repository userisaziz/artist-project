import { renderRouter, screen, fireEvent, waitFor } from 'expo-router/testing-library';
import * as SecureStore from 'expo-secure-store';
import { transport } from '../../core/api/client';
import { MockTransport } from '../../mocks/transport';
import { formatPrice } from '../../utils/common/format';
import { addDays, formatDay, istDateKey, istDayStart } from '../../utils/common/time';

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
const mock = transport as MockTransport;
const PRIYA = '+15550009999';
const KAVYA = '+919900000003';
const ZARA = '+919900000004';
const HOUR = 3600_000;

let logSpy: jest.SpyInstance;
beforeEach(() => {
  store.clear();
  logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
});
afterEach(() => { logSpy.mockRestore(); });

/** Signs a seeded (approved) artist in; ends on the artist Home tab. */
async function signInArtist(phone: string, firstName: string) {
  mock.advanceTime(61_000); // past the per-number OTP resend cooldown (a phone may sign in twice in this file)
  await renderRouter('./app');
  await fireEvent.press(await screen.findByText('Get started'));
  if (phone.startsWith('+1')) {
    await fireEvent.press(await screen.findByLabelText('Country code +91'));
    await fireEvent.press(await screen.findByText('USA / Canada'));
  }
  await fireEvent.changeText(await screen.findByTestId('phone-national'), phone.replace(/^\+(1|91)/, ''));
  await fireEvent.press(screen.getByText('Send code'));
  const banner = await screen.findByText(/^Mock mode: your code is \d{6}$/);
  await fireEvent.changeText(screen.getByTestId('otp-box-0'), String(banner.props.children).match(/\d{6}/)![0]);
  expect(await screen.findByText(new RegExp(`^Good (morning|afternoon|evening), ${firstName}$`))).toBeTruthy();
}

const at11 = (days: number) => new Date(istDayStart(addDays(istDateKey(Date.now()), days)) + 11 * HOUR).toISOString();

it('a new request shows "You earn" and a countdown; Accept moves it to Upcoming', async () => {
  const req = mock.requestBooking('+919800044444', PRIYA, { startAt: at11(2), firstName: 'Ananya', lastName: 'Rao', note: 'Our date on the wrist' });
  await signInArtist(PRIYA, 'Priya');
  expect(screen.getByText('Earnings this month')).toBeTruthy();
  expect(await screen.findByText('Ananya Rao')).toBeTruthy();
  expect(screen.getByText('You earn')).toBeTruthy();
  expect(screen.getAllByText(formatPrice(req.artist_earning_paise!)).length).toBeGreaterThan(0);
  expect(screen.getByText(/^[23]h \d+m left$/)).toBeTruthy();
  expect(screen.getByText(/Our date on the wrist/)).toBeTruthy();

  await fireEvent.press(screen.getByLabelText('Accept Ananya Rao'));
  await waitFor(() => expect(screen.queryByText('Ananya Rao')).toBeNull());

  await fireEvent.press(screen.getByLabelText('Bookings tab'));
  expect(await screen.findByText('Requests · 0')).toBeTruthy();
  await fireEvent.press(screen.getByText('Upcoming'));
  expect(await screen.findByText('Ananya Rao')).toBeTruthy();
  const complete = screen.getAllByLabelText(/^Mark completed/)[0];
  expect(complete.props.accessibilityState).toMatchObject({ disabled: true }); // not started yet
});

it('Decline takes an optional reason and moves the request to Past', async () => {
  mock.requestBooking('+919800066666', KAVYA, { startAt: at11(3), firstName: 'Diya', lastName: 'Shah' });
  await signInArtist(KAVYA, 'Kavya');
  await fireEvent.press(screen.getByLabelText('Bookings tab'));
  expect(await screen.findByText('Requests · 2')).toBeTruthy(); // the seeded request and Diya's
  await fireEvent.press(await screen.findByLabelText('Decline Diya Shah'));
  await fireEvent.changeText(await screen.findByLabelText('Reason (optional)'), 'Fully booked that day');
  await fireEvent.press(screen.getByText('Confirm decline'));
  expect(await screen.findByText('Requests · 1')).toBeTruthy();
  expect(screen.queryByText('Diya Shah')).toBeNull();
  await fireEvent.press(screen.getByText('Past'));
  expect(await screen.findByText('Diya Shah')).toBeTruthy();
  expect(screen.getByText('Declined')).toBeTruthy();
});

it('the calendar marks booked days and lists a tapped day’s agenda', async () => {
  const start = at11(4);
  mock.requestBooking('+919800077777', ZARA, { startAt: start, firstName: 'Isha', lastName: 'Menon' });
  await signInArtist(ZARA, 'Zara');
  await fireEvent.press(screen.getByLabelText('Calendar tab'));
  if (istDateKey(start).slice(0, 7) !== istDateKey(Date.now()).slice(0, 7)) await fireEvent.press(await screen.findByLabelText('Next month'));
  await fireEvent.press(await screen.findByLabelText(new RegExp(`^${formatDay(istDateKey(start))}, .*booking`)));
  expect(await screen.findByText('Isha Menon')).toBeTruthy();
  expect(screen.getByText('Awaiting confirmation')).toBeTruthy();
});

it('Me shows the verified profile, previews the storefront and switches to the customer side', async () => {
  await signInArtist(PRIYA, 'Priya');
  await fireEvent.press(screen.getByLabelText('Me tab'));
  expect(await screen.findByText('Priya Bridal Studio')).toBeTruthy();
  expect(screen.getByText('✓ Verified')).toBeTruthy();
  await fireEvent.press(screen.getByText('View public profile'));
  expect(await screen.findByText('Packages')).toBeTruthy();
  expect(screen.queryByText('Check availability')).toBeNull();
  await fireEvent.press(screen.getAllByLabelText('Back')[0]);
  await fireEvent.press(await screen.findByText('Switch to customer'));
  expect(await screen.findByText('Discover artists')).toBeTruthy();
});
