import { renderRouter, screen, fireEvent } from 'expo-router/testing-library';
import * as SecureStore from 'expo-secure-store';
import { transport } from '../core/api/client';
import { MockTransport } from '../core/api/mock/transport';
import { ratingLong } from '../reviews/format';
import type { Review, ReviewPage } from '../core/api/types';

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
const AYESHA = '+919900000002';
const RHEA = '+919900000006';

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

/** Every public rating of an artist, straight from the API. */
async function publicRatings(artistId: string): Promise<number[]> {
  const res = await mock.request({ method: 'GET', path: `/artists/${artistId}/reviews?limit=50` });
  return (res.json as ReviewPage<Review>).items.map((r) => r.rating);
}

const average = (ratings: number[]) => Math.round((ratings.reduce((s, r) => s + r, 0) / ratings.length) * 10) / 10;

/** Bookings → Past → "Review" on the completed booking → rate it with `stars` and `text`. */
async function rateFromPast(serviceName: string, stars: number, text: string) {
  await fireEvent.press(screen.getByLabelText('Bookings tab'));
  await fireEvent.press(await screen.findByText('Past'));
  await fireEvent.press(await screen.findByLabelText(`Review ${serviceName}`));
  expect(await screen.findByText('Rate your experience')).toBeTruthy();
  expect(screen.getByLabelText('Post review').props.accessibilityState).toMatchObject({ disabled: true }); // a rating first
  await fireEvent.press(screen.getByLabelText(`${stars} stars`));
  await fireEvent.changeText(screen.getByLabelText('Your review (optional)'), text);
  await fireEvent.press(screen.getByLabelText('Post review'));
}

/** Back from the booking to Home, then the artist's storefront. */
async function openStorefront(artist: string) {
  await fireEvent.press(screen.getAllByLabelText('Back')[0]);
  await fireEvent.press(await screen.findByLabelText('Home tab'));
  await fireEvent.press((await screen.findAllByText(artist))[0]);
  expect(await screen.findByText('✓ Verified artist')).toBeTruthy();
}

it('a customer rates a completed booking and sees it on the storefront with the new average', async () => {
  await signUpCustomer('9845071001');
  const booking = mock.completedBooking('+919845071001', AYESHA);
  const before = await publicRatings(booking.artist.id);

  await rateFromPast(booking.service_name, 5, 'She hid our initials in the design!');
  expect(await screen.findByText('Thanks for your review')).toBeTruthy();
  expect(screen.queryByText('Rate your experience')).toBeNull();
  expect(screen.getByLabelText('Rated 5 out of 5')).toBeTruthy();

  await openStorefront('Ayesha Mehendi Art');
  const after = [...before, 5];
  expect(await screen.findByLabelText(ratingLong(average(after), after.length))).toBeTruthy();
  expect(await screen.findByText('She hid our initials in the design!')).toBeTruthy(); // newest first, in the first three
  expect(screen.getByText('Response from Ayesha Mehendi Art')).toBeTruthy(); // the seeded reply
  expect(screen.getByText('See all reviews')).toBeTruthy();

  await fireEvent.press(screen.getByText('See all reviews'));
  expect(await screen.findByText('All reviews')).toBeTruthy();
  expect(await screen.findByText('She hid our initials in the design!')).toBeTruthy();
  expect(screen.getByLabelText(`5 stars: ${after.filter((r) => r === 5).length}`)).toBeTruthy();
});

it('a review with a phone number is being checked and doesn’t appear publicly', async () => {
  await signUpCustomer('9845071002');
  const booking = mock.completedBooking('+919845071002', RHEA);
  const before = await publicRatings(booking.artist.id);
  const text = 'Lovely! Call 98450 12345 for a discount';

  await rateFromPast(booking.service_name, 4, text);
  expect(await screen.findByText('Thanks! Your review is being checked before it appears.')).toBeTruthy();

  await openStorefront('Rhea Makeovers');
  expect(await screen.findByLabelText(ratingLong(average(before), before.length))).toBeTruthy();
  expect(screen.queryByText(text)).toBeNull();
});
