import { renderRouter, screen, fireEvent, waitFor } from 'expo-router/testing-library';
import * as SecureStore from 'expo-secure-store';
import { transport } from '../../core/api/client';
import { MockTransport } from '../../mocks/transport';
import { priceBreakdown } from '../../utils/bookings/pricing';
import { addDays, formatDay, istDateKey, istDayStart } from '../../utils/common/time';
import { formatPrice } from '../../utils/common/format';

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
const HOUR = 3600_000;

let logSpy: jest.SpyInstance;
beforeEach(() => {
  store.clear();
  logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
});
afterEach(() => { logSpy.mockRestore(); });

/** A brand-new number signs up as a customer named Ananya; ends on the Home tab. */
async function signUpCustomer(national: string) {
  await renderRouter('./app');
  await fireEvent.press(await screen.findByText('Get started'));
  await fireEvent.changeText(await screen.findByTestId('phone-national'), national);
  await fireEvent.press(screen.getByText('Send code'));
  const banner = await screen.findByText(/^Mock mode: your code is \d{6}$/);
  await fireEvent.changeText(screen.getByTestId('otp-box-0'), String(banner.props.children).match(/\d{6}/)![0]);
  await fireEvent.changeText(await screen.findByLabelText('First name'), 'Ananya');
  await fireEvent.press(screen.getByText('Continue'));
  await fireEvent.press(await screen.findByText('Browse artists'));
  expect(await screen.findByText(/^Good (morning|afternoon|evening), Ananya$/)).toBeTruthy();
}

/** Home → storefront → pick `service` → Date & time; picks 11:00 AM `days` ahead. Returns the slot's ISO start. */
async function pickSlot(artist: string, service: string, days: number) {
  await fireEvent.press((await screen.findAllByText(artist))[0]);
  expect(await screen.findByText('✓ Verified artist')).toBeTruthy();
  await fireEvent.press(await screen.findByLabelText(`Select ${service}`));
  await fireEvent.press(screen.getByText('Check availability'));
  expect(await screen.findByText('Step 1 of 2')).toBeTruthy();
  const date = addDays(istDateKey(Date.now()), days);
  await fireEvent.press(screen.getByLabelText(formatDay(date)));
  await fireEvent.press(await screen.findByLabelText('11:00 AM, available'));
  expect(await screen.findByText(`${formatDay(date)} · 11:00 AM`)).toBeTruthy();
  return new Date(istDayStart(date) + 11 * HOUR).toISOString();
}

it('customer books a seeded artist, sees it awaiting confirmation, and cancels it with a refund', async () => {
  await signUpCustomer('9845070001');
  expect(screen.getByText('Discover artists')).toBeTruthy();
  expect((await screen.findAllByText('Ayesha Mehendi Art')).length).toBeGreaterThan(0);

  await pickSlot('Ayesha Mehendi Art', 'Bridal Full Arms', 4);
  await fireEvent.press(screen.getByText('Continue'));
  expect(await screen.findByText('Step 2 of 2')).toBeTruthy();
  const money = priceBreakdown(650_000);
  expect(screen.getByText(formatPrice(money.total_paise))).toBeTruthy();
  expect(screen.getByText('Test mode: no real payment is taken.')).toBeTruthy();
  const pay = `Pay deposit · ${formatPrice(money.deposit_paise)}`;
  await fireEvent.press(screen.getByText(pay));
  expect(screen.queryByText('Booking requested')).toBeNull(); // the address is required
  await fireEvent.changeText(screen.getByLabelText('Address'), '12 MG Road, Bangalore');
  await fireEvent.changeText(screen.getByLabelText('Note for the artist (optional)'), 'Lighter palms please');
  await fireEvent.press(screen.getByText(pay));

  expect(await screen.findByText('Booking requested')).toBeTruthy();
  expect(screen.getByText('Ayesha Mehendi Art usually confirms within 3 hours.')).toBeTruthy();
  await fireEvent.press(screen.getByText('Back to home'));
  expect(await screen.findByText(/^Good (morning|afternoon|evening), Ananya$/)).toBeTruthy();

  await fireEvent.press(screen.getByLabelText('Bookings tab'));
  expect(await screen.findByText('Awaiting confirmation')).toBeTruthy();
  await fireEvent.press(screen.getByText('Bridal Full Arms'));
  expect(await screen.findByText('Lighter palms please')).toBeTruthy();
  await fireEvent.press(screen.getByText('Cancel booking'));
  expect(await screen.findByText(`Your ${formatPrice(money.deposit_paise)} deposit will be refunded.`)).toBeTruthy();
  await fireEvent.press(screen.getByText('Yes, cancel'));
  expect(await screen.findByText('Cancelled')).toBeTruthy();
  expect(screen.queryByText('Cancel booking')).toBeNull();
});

it('a slot taken while paying sends the customer back to Date & time with fresh slots', async () => {
  await signUpCustomer('9845070002');
  const start = await pickSlot('Glow by Kavya', 'Party Makeup', 5);
  await fireEvent.press(screen.getByText('Continue'));
  await fireEvent.changeText(await screen.findByLabelText('Address'), 'Indiranagar, Bangalore');
  mock.requestBooking('+919800099999', '+919900000003', { startAt: start }); // someone else gets there first
  await fireEvent.press(screen.getByText(/^Pay deposit · /));
  expect(await screen.findByText('That time was just taken. Pick another slot.')).toBeTruthy();
  expect(screen.getByText('Step 1 of 2')).toBeTruthy();
  expect(await screen.findByLabelText('11:00 AM, taken')).toBeTruthy();
});

it('Explore searches by name or service, and says so when nothing matches', async () => {
  await signUpCustomer('9845070003');
  await fireEvent.press(screen.getByLabelText('Explore tab'));
  expect(await screen.findByText('6 artists')).toBeTruthy();
  await fireEvent.changeText(screen.getByLabelText('Search artists'), 'airbrush');
  expect(await screen.findByText('1 artist')).toBeTruthy();
  expect(screen.getByText('Glow by Kavya')).toBeTruthy();
  await fireEvent.changeText(screen.getByLabelText('Search artists'), 'zzzz');
  expect(await screen.findByText('No artists match yet. Try another category.')).toBeTruthy();
});

it('Profile shows the account and "Become an artist" switches to the artist side', async () => {
  await signUpCustomer('9845070004');
  await fireEvent.press(screen.getByLabelText('Profile tab'));
  expect(await screen.findByText('+91 98450 70004')).toBeTruthy();
  await fireEvent.press(screen.getByText('Become an artist'));
  expect(await screen.findByText('Turn your craft into bookings')).toBeTruthy(); // artist onboarding
});

it('Log out on Profile returns to Welcome and clears the session', async () => {
  await signUpCustomer('9845070005');
  await fireEvent.press(screen.getByLabelText('Profile tab'));
  await fireEvent.press(await screen.findByText('Log out'));
  expect(await screen.findByText('Get started')).toBeTruthy();
  await waitFor(() => expect(store.size).toBe(0));
});
