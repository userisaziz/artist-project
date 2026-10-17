import { renderRouter, screen, fireEvent, waitFor } from 'expo-router/testing-library';
import * as SecureStore from 'expo-secure-store';
import { transport } from '../core/api/client';
import { MockTransport } from '../core/api/mock/transport';

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

let logSpy: jest.SpyInstance;
beforeEach(() => {
  store.clear();
  logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
});
afterEach(() => { logSpy.mockRestore(); });

/** Signs Priya (seeded, approved, +1 number) in and opens the Me tab. */
async function priyaOnMe() {
  mock.advanceTime(61_000); // past the per-number OTP resend cooldown (Priya signs in twice in this file)
  await renderRouter('./app');
  await fireEvent.press(await screen.findByText('Get started'));
  await fireEvent.press(await screen.findByLabelText('Country code +91'));
  await fireEvent.press(await screen.findByText('USA / Canada'));
  await fireEvent.changeText(await screen.findByTestId('phone-national'), PRIYA.replace(/^\+1/, ''));
  await fireEvent.press(screen.getByText('Send code'));
  const banner = await screen.findByText(/^Mock mode: your code is \d{6}$/);
  await fireEvent.changeText(screen.getByTestId('otp-box-0'), String(banner.props.children).match(/\d{6}/)![0]);
  expect(await screen.findByText(/^Good (morning|afternoon|evening), Priya$/)).toBeTruthy();
  await fireEvent.press(screen.getByLabelText('Me tab'));
  expect(await screen.findByText('Priya Bridal Studio')).toBeTruthy();
}

it('the artist replies to one review and reports another', async () => {
  mock.completedBooking('+919800055501', PRIYA, { firstName: 'Diya', lastName: 'Shah', review: { rating: 5, text: 'Loved the bridal look' } });
  mock.completedBooking('+919800055502', PRIYA, { firstName: 'Isha', lastName: 'Menon', review: { rating: 1, text: 'Arrived two hours late' } });
  await priyaOnMe();
  await fireEvent.press(await screen.findByLabelText(/^Reviews, /));
  expect(await screen.findByText('Loved the bridal look')).toBeTruthy();

  await fireEvent.press(screen.getByLabelText('Reply to Diya S.'));
  await fireEvent.changeText(await screen.findByLabelText('Your reply'), 'Thanks! Book again on 98450 12345');
  await fireEvent.press(screen.getByText('Post reply'));
  expect(await screen.findByText("Replies can't include phone numbers, emails, links or blocked words")).toBeTruthy();
  await fireEvent.changeText(screen.getByLabelText('Your reply'), 'Thank you, Diya!');
  await fireEvent.press(screen.getByText('Post reply'));
  expect(await screen.findByText('Thank you, Diya!')).toBeTruthy();
  expect(screen.getByText('Response from Priya Bridal Studio')).toBeTruthy();
  expect(screen.getByLabelText('Edit reply to Diya S.')).toBeTruthy();

  await fireEvent.press(screen.getByLabelText('Report review by Isha M.'));
  await fireEvent.changeText(await screen.findByLabelText('Reason'), 'We were on time; she cancelled');
  await fireEvent.press(screen.getByText('Send report'));
  expect(await screen.findByText('Reported')).toBeTruthy();
  expect(screen.queryByLabelText('Report review by Isha M.')).toBeNull();
});

it('the artist adds a custom service, edits it back to review and deletes it', async () => {
  await priyaOnMe();
  await fireEvent.press(await screen.findByLabelText(/^My services, /));
  expect(await screen.findByText('Mehendi › Bridal')).toBeTruthy();
  expect(screen.getByText('Bridal Classic')).toBeTruthy(); // picked from the admin list: read-only
  expect(screen.queryByLabelText('Edit Bridal Classic')).toBeNull();

  await fireEvent.press(screen.getByText('Add a custom service'));
  await fireEvent.press(await screen.findByText('Mehendi'));
  await fireEvent.press(await screen.findByText('Arabic'));
  await fireEvent.changeText(screen.getByLabelText('Service name'), 'Glitter Arabic');
  await fireEvent.changeText(screen.getByLabelText('Price (₹)'), '2500');
  await fireEvent.changeText(screen.getByLabelText('Duration (minutes)'), '75');
  await fireEvent.press(screen.getByText('Send for review'));
  expect(await screen.findByText('Glitter Arabic')).toBeTruthy();
  expect(screen.getByText('In review')).toBeTruthy();
  expect(screen.getByText('Mehendi › Arabic')).toBeTruthy();
  expect(screen.getByText('₹2,500 · 1 hr 15 min')).toBeTruthy();

  await fireEvent.press(screen.getByLabelText('Edit Glitter Arabic'));
  expect(await screen.findByText('Saving sends it back for review.')).toBeTruthy();
  await fireEvent.changeText(screen.getByLabelText('Price (₹)'), '3000');
  await fireEvent.press(screen.getByText('Send for review'));
  expect(await screen.findByText('₹3,000 · 1 hr 15 min')).toBeTruthy();
  expect(screen.getByText('In review')).toBeTruthy();

  await fireEvent.press(screen.getByLabelText('Delete Glitter Arabic'));
  await fireEvent.press(await screen.findByText('Yes, delete'));
  await waitFor(() => expect(screen.queryByText('Glitter Arabic')).toBeNull());
});
