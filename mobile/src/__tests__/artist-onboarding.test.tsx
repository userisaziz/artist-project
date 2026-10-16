import { renderRouter, screen, fireEvent, waitFor } from 'expo-router/testing-library';
import * as SecureStore from 'expo-secure-store';
import * as ImagePicker from 'expo-image-picker';
import { transport } from '../api/client';
import { MockTransport } from '../api/mock/transport';
import { queryClient } from '../api/query-client';

jest.mock('expo-secure-store', () => {
  const store = new Map<string, string>();
  return {
    setItemAsync: (k: string, v: string) => Promise.resolve(store.set(k, v)),
    getItemAsync: (k: string) => Promise.resolve(store.get(k) ?? null),
    deleteItemAsync: (k: string) => Promise.resolve(store.delete(k)),
    __store: store,
  };
});
jest.mock('expo-image-picker', () => ({ launchImageLibraryAsync: jest.fn() }));
jest.mock('expo-image-manipulator', () => ({
  SaveFormat: { JPEG: 'jpeg' },
  ImageManipulator: {
    manipulate: (uri: string) => {
      const ctx = { resize: () => ctx, renderAsync: async () => ({ saveAsync: async () => ({ uri, width: 1200, height: 900 }) }) };
      return ctx;
    },
  },
}));

const store = (SecureStore as unknown as { __store: Map<string, string> }).__store;
const launch = ImagePicker.launchImageLibraryAsync as jest.Mock;
let pickSeq = 0;

/** The next library pick returns `n` photos. */
function mockPicks(n: number) {
  launch.mockResolvedValueOnce({ canceled: false, assets: Array.from({ length: n }, () => ({ uri: `file:///pick-${++pickSeq}.jpg`, width: 3000, height: 2000 })) });
}

let logSpy: jest.SpyInstance;
beforeEach(() => {
  store.clear();
  launch.mockReset();
  logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
});
afterEach(() => { logSpy.mockRestore(); });

const INVALID = 'That doesn’t look like a valid Aadhaar number.';

/** Fresh number → OTP → name → "Create your profile"; ends on the Intro. */
async function startArtist(national: string, name = 'Ayesha') {
  await renderRouter('./app');
  await fireEvent.press(await screen.findByText('Get started'));
  await fireEvent.changeText(await screen.findByTestId('phone-national'), national);
  await fireEvent.press(screen.getByText('Send code'));
  const banner = await screen.findByText(/^Mock mode: your code is \d{6}$/);
  await fireEvent.changeText(screen.getByTestId('otp-box-0'), String(banner.props.children).match(/\d{6}/)![0]);
  await fireEvent.changeText(await screen.findByLabelText('First name'), name);
  await fireEvent.press(screen.getByText('Continue'));
  await fireEvent.press(await screen.findByText('Create your profile'));
  expect(await screen.findByText('Turn your craft into bookings')).toBeTruthy();
}

/** Intro → Profile, filled in and saved; ends on Services. */
async function fillProfile() {
  await fireEvent.press(screen.getByText('Let’s get started'));
  expect(await screen.findByText('Tell clients who you are')).toBeTruthy();
  expect(screen.getByLabelText('Step 1 of 4')).toBeTruthy();
  mockPicks(1);
  await fireEvent.press(screen.getByLabelText('Add profile photo'));
  expect(await screen.findByLabelText('Change profile photo')).toBeTruthy();
  await fireEvent.changeText(screen.getByLabelText('Business name'), 'Ayesha Mehendi Art');
  await fireEvent.press(await screen.findByText('Mehendi'));
  await fireEvent.press(screen.getByLabelText('City'));
  await fireEvent.press(await screen.findByText('Bangalore'));
  await fireEvent.press(screen.getByText('Continue'));
  expect(await screen.findByLabelText('Step 2 of 4')).toBeTruthy();
}

it('Intro → Profile saves a draft and moves on to Services', async () => {
  await startArtist('9845044441');
  expect(screen.getByText('4 short steps')).toBeTruthy();
  expect(screen.queryByText(/every Monday/)).toBeNull();
  await fillProfile();
});

it('Profile Continue stays disabled until photo, name, a category and a city are set', async () => {
  await startArtist('9845044442');
  await fireEvent.press(screen.getByText('Let’s get started'));
  await fireEvent.changeText(await screen.findByLabelText('Business name'), 'Studio');
  await fireEvent.press(await screen.findByText('Makeup'));
  await fireEvent.press(screen.getByText('Continue'));
  expect(screen.queryByLabelText('Step 2 of 4')).toBeNull(); // no photo or city yet
});

/** Opens the sheet and picks Mehendi (preselected, the only category) › Bridal › Bridal Classic. */
async function pickBridalClassic() {
  await fireEvent.press(screen.getByText('+ Add service'));
  await fireEvent.press(await screen.findByText('Bridal'));
  await fireEvent.press(await screen.findByLabelText('Bridal Classic'));
}

/** Services: add "Bridal Classic" (₹4,500, 180 min) from the admin's list through the sheet. */
async function addService() {
  await pickBridalClassic();
  await fireEvent.changeText(await screen.findByLabelText('Price (₹)'), '4500');
  await fireEvent.changeText(screen.getByLabelText('Duration (minutes)'), '180');
  await fireEvent.press(screen.getByText('Save service'));
  expect(await screen.findByText('Bridal Classic')).toBeTruthy();
  expect(screen.getByText('Mehendi › Bridal · ₹4,500 · 3 hr')).toBeTruthy();
}

it('Services: Continue needs a service; services can be added and removed', async () => {
  await startArtist('9845044443');
  await fillProfile();
  expect(screen.getByText('Set your prices')).toBeTruthy();
  await fireEvent.press(screen.getByText('Continue'));
  expect(screen.queryByLabelText('Step 3 of 4')).toBeNull();

  await addService();
  await fireEvent.press(screen.getByLabelText('Remove Bridal Classic'));
  await waitFor(() => expect(screen.queryByText('Bridal Classic')).toBeNull());

  await addService();
  await fireEvent.press(screen.getByText('Continue'));
  expect(await screen.findByLabelText('Step 3 of 4')).toBeTruthy();
});

it('the Add service sheet rejects a zero price before calling the server', async () => {
  await startArtist('9845044444');
  await fillProfile();
  await pickBridalClassic();
  await fireEvent.changeText(await screen.findByLabelText('Price (₹)'), '0');
  await fireEvent.changeText(screen.getByLabelText('Duration (minutes)'), '30');
  await fireEvent.press(screen.getByText('Save service'));
  expect(await screen.findByText('Enter a price above ₹0.')).toBeTruthy();
});

it('the Add service sheet steps through subcategory and service, and marks services already added', async () => {
  await startArtist('9845044460');
  await fillProfile();
  await fireEvent.press(screen.getByText('+ Add service'));
  expect(screen.queryByLabelText('Price (₹)')).toBeNull(); // nothing to price until a service is picked
  await fireEvent.press(await screen.findByText('Arabic'));
  expect(await screen.findByLabelText('Arabic Hands')).toBeTruthy();
  expect(screen.queryByLabelText('Bridal Classic')).toBeNull(); // only the chosen subcategory's services
  await fireEvent.press(screen.getByLabelText('Close'));

  await addService();
  await fireEvent.press(screen.getByText('+ Add service'));
  await fireEvent.press(await screen.findByText('Bridal'));
  const added = await screen.findByLabelText('Bridal Classic, added');
  expect(added.props.accessibilityState).toMatchObject({ disabled: true });
  expect(screen.getByLabelText('Bridal Full Arms').props.accessibilityState).toMatchObject({ disabled: false });
});

it('the Add service sheet says so when the artist’s categories have no services yet', async () => {
  await startArtist('9845044461');
  await fireEvent.press(screen.getByText('Let’s get started'));
  mockPicks(1);
  await fireEvent.press(await screen.findByLabelText('Add profile photo'));
  expect(await screen.findByLabelText('Change profile photo')).toBeTruthy();
  await fireEvent.changeText(screen.getByLabelText('Business name'), 'Hair by Ira');
  await fireEvent.press(await screen.findByText('Hair')); // the mock lists nothing under Hair yet
  await fireEvent.press(screen.getByLabelText('City'));
  await fireEvent.press(await screen.findByText('Bangalore'));
  await fireEvent.press(screen.getByText('Continue'));
  await fireEvent.press(await screen.findByText('+ Add service'));
  expect(await screen.findByText('Services for your categories are being set up. Check back soon.')).toBeTruthy();
});

/** Portfolio: pick and upload `n` photos in one go; waits until `total` tiles are on screen. */
async function addPhotos(n: number, total = n) {
  mockPicks(n);
  await fireEvent.press(screen.getByLabelText('Add photos'));
  await waitFor(() => expect(screen.queryAllByLabelText(/^Portfolio photo \d+$/)).toHaveLength(total), { timeout: 5000 });
}

/** Identity: type the number and upload both sides of the card; leaves Submit for review enabled. */
async function fillIdentity(number = '234123412346') {
  expect(await screen.findByText('Confirm it’s you')).toBeTruthy();
  expect(screen.getByLabelText('Step 4 of 4')).toBeTruthy();
  await fireEvent.changeText(screen.getByLabelText('Aadhaar number'), number);
  for (const side of ['front', 'back']) {
    mockPicks(1);
    await fireEvent.press(screen.getByLabelText(`Add ${side} of card`));
    expect(await screen.findByLabelText(`Retake ${side} of card`)).toBeTruthy();
  }
}

/** Submit for review from Identity; ends on the In review timeline. */
async function submitIdentity() {
  await fireEvent.press(screen.getByText('Submit for review'));
  expect(await screen.findByText('Your profile is in review')).toBeTruthy();
}

it('Portfolio: counts toward six, marks the cover, Make cover and Remove work, then Continue opens Identity, which submits to In review', async () => {
  await startArtist('9845044445');
  await fillProfile();
  await addService();
  await fireEvent.press(screen.getByText('Continue'));
  expect(await screen.findByText('Show your best work')).toBeTruthy();
  expect(screen.getByText('Continue · 0 of 6 photos')).toBeTruthy();

  await addPhotos(5);
  expect(screen.getByText('Continue · 5 of 6 photos')).toBeTruthy();
  expect(screen.getByText('Cover')).toBeTruthy();

  // Long-press selects a tile; Make cover moves it first; Remove drops it.
  await fireEvent(screen.getByLabelText('Portfolio photo 3'), 'longPress');
  await fireEvent.press(await screen.findByText('Make cover'));
  await waitFor(() => expect(screen.queryByText('Make cover')).toBeNull());
  await fireEvent(screen.getByLabelText('Portfolio photo 2'), 'longPress');
  await fireEvent.press(await screen.findByText('Remove'));
  await waitFor(() => expect(screen.queryAllByLabelText(/^Portfolio photo \d+$/)).toHaveLength(4));

  await addPhotos(2, 6);
  await fireEvent.press(await screen.findByText('Continue'));
  await fillIdentity();
  await submitIdentity();
  expect(screen.getByText('Profile submitted')).toBeTruthy();
  expect(screen.getByText('Identity & portfolio check')).toBeTruthy();
});

const mock = transport as MockTransport;

/** Profile, one service and six photos for a fresh number; ends on Identity. */
async function toIdentity(national: string) {
  await startArtist(national);
  await fillProfile();
  await addService();
  await fireEvent.press(screen.getByText('Continue'));
  await addPhotos(6);
  await fireEvent.press(await screen.findByText('Continue'));
}

/** Runs the whole flow to In review for a fresh number. */
async function submitFor(national: string) {
  await toIdentity(national);
  await fillIdentity();
  await submitIdentity();
}

it('a rejected profile shows the reason, and Edit and resubmit goes back through the steps', async () => {
  await submitFor('9845044446');
  mock.review('+919845044446', 'rejected', 'Portfolio photos are blurry');
  await queryClient.invalidateQueries({ queryKey: ['artist'] });
  expect(await screen.findByText('Portfolio photos are blurry')).toBeTruthy();
  expect(screen.getByText('Your profile needs a few changes')).toBeTruthy();

  await fireEvent.press(screen.getByText('Edit and resubmit'));
  expect(await screen.findByText('Tell clients who you are')).toBeTruthy();
  expect(screen.getByLabelText('Business name').props.value).toBe('Ayesha Mehendi Art'); // prefilled from the saved profile
  await fireEvent.press(screen.getByText('Continue'));
  expect(await screen.findByText('Bridal Classic')).toBeTruthy();
  await fireEvent.press(screen.getByText('Continue'));
  expect(await screen.findByText('Show your best work')).toBeTruthy();
  await fireEvent.press(screen.getByText('Continue'));
  // The app never gets the number or the photos back: it shows the last 4 digits, and resubmits without re-entering them.
  expect(await screen.findByText('Aadhaar on file •••• 2346')).toBeTruthy();
  expect(screen.queryByLabelText('Aadhaar number')).toBeNull();
  const spy = jest.spyOn(transport, 'request');
  try {
    await submitIdentity();
    expect(spy.mock.calls.map(([r]) => r.path)).not.toContain('/artists/me/kyc');
  } finally {
    spy.mockRestore();
  }
});

it('approval moves the artist to the home', async () => {
  await submitFor('9845044447');
  mock.review('+919845044447', 'approved');
  await queryClient.invalidateQueries({ queryKey: ['artist'] });
  expect(await screen.findByText(/^Good (morning|afternoon|evening), Ayesha$/)).toBeTruthy();
  expect(screen.getByText('Earnings this month')).toBeTruthy();
});

it('quitting mid-way resumes at the first incomplete step', async () => {
  await startArtist('9845044448');
  await fillProfile(); // profile saved, no services yet
  // Cold restart: same stored session, empty cache.
  await screen.unmount();
  queryClient.clear();
  await renderRouter('./app');
  expect(await screen.findByText('Set your prices')).toBeTruthy();
});

it('Identity: groups the number, flags a bad checksum on blur, and a failed submit keeps the artist on the step', async () => {
  await toIdentity('9845044450');
  const field = () => screen.getByLabelText('Aadhaar number');
  await fireEvent.changeText(field(), '2341-2341-2347-99'); // non-digits dropped, capped at 12
  expect(field().props.value).toBe('2341 2341 2347');
  expect(screen.queryByText(INVALID)).toBeNull(); // not while typing
  await fireEvent(field(), 'blur');
  expect(await screen.findByText(INVALID)).toBeTruthy();
  await fireEvent.changeText(field(), '234123412346');
  await waitFor(() => expect(screen.queryByText(INVALID)).toBeNull());

  await fillIdentity();
  const real = transport.request.bind(transport);
  const spy = jest.spyOn(transport, 'request').mockImplementation((r) =>
    r.path === '/artists/me/submit' ? Promise.resolve({ status: 500, json: null }) : real(r));
  try {
    await fireEvent.press(screen.getByText('Submit for review'));
    expect(await screen.findByText('Something went wrong. Please try again.')).toBeTruthy();
    expect(screen.getByText('Confirm it’s you')).toBeTruthy();
    // The details were saved before submit failed, so they are on file and the retry only submits.
    expect(screen.getByText('Aadhaar on file •••• 2346')).toBeTruthy();
    spy.mockClear();
    spy.mockImplementation(real);
    await submitIdentity();
    expect(spy.mock.calls.map(([r]) => r.path)).not.toContain('/artists/me/kyc');
  } finally {
    spy.mockRestore();
  }
});

it('Replace details after a rejection needs the number and both photos again', async () => {
  await submitFor('9845044451');
  mock.review('+919845044451', 'rejected', 'Aadhaar photo is unreadable');
  await queryClient.invalidateQueries({ queryKey: ['artist'] });
  await fireEvent.press(await screen.findByText('Edit and resubmit'));
  expect(await screen.findByText('Tell clients who you are')).toBeTruthy();
  await fireEvent.press(screen.getByText('Continue'));
  expect(await screen.findByText('Bridal Classic')).toBeTruthy();
  await fireEvent.press(screen.getByText('Continue'));
  expect(await screen.findByText('Show your best work')).toBeTruthy();
  await fireEvent.press(screen.getByText('Continue'));
  await fireEvent.press(await screen.findByText('Replace details'));
  expect(screen.getByLabelText('Aadhaar number').props.value).toBe('');
  expect(screen.getByLabelText('Add front of card')).toBeTruthy();
  expect(screen.queryByText(/^Aadhaar on file/)).toBeNull();

  const spy = jest.spyOn(transport, 'request');
  const kycPuts = () => spy.mock.calls.filter(([r]) => r.path === '/artists/me/kyc');
  try {
    await fireEvent.press(screen.getByText('Submit for review')); // nothing entered
    await fireEvent.changeText(screen.getByLabelText('Aadhaar number'), '498765432102');
    await fireEvent.press(screen.getByText('Submit for review')); // no photos
    mockPicks(1);
    await fireEvent.press(screen.getByLabelText('Add front of card'));
    expect(await screen.findByLabelText('Retake front of card')).toBeTruthy();
    await fireEvent.press(screen.getByText('Submit for review')); // no back photo
    expect(kycPuts()).toHaveLength(0);
    expect(screen.getByText('Confirm it’s you')).toBeTruthy();

    mockPicks(1);
    await fireEvent.press(screen.getByLabelText('Add back of card'));
    expect(await screen.findByLabelText('Retake back of card')).toBeTruthy();
    await submitIdentity();
    expect(kycPuts()).toHaveLength(1);
    expect(kycPuts()[0][0].body).toMatchObject({ aadhaar_number: '498765432102' });
  } finally {
    spy.mockRestore();
  }
});

it('quitting on Identity resumes there at step 4 of 4, and Back returns to Portfolio', async () => {
  await toIdentity('9845044452');
  await screen.unmount();
  queryClient.clear();
  await renderRouter('./app');
  expect(await screen.findByText('Confirm it’s you')).toBeTruthy();
  expect(screen.getByLabelText('Step 4 of 4')).toBeTruthy();
  await fireEvent.press(screen.getByLabelText('Back'));
  expect(await screen.findByText('Show your best work')).toBeTruthy();
});

it('a failed categories load shows the error with Try again, which recovers', async () => {
  await startArtist('9845044449');
  queryClient.removeQueries({ queryKey: ['catalog'] }); // cached app-wide; make the failure actually fetch
  queryClient.setDefaultOptions({ queries: { retry: false, staleTime: 30_000 } }); // skip the retry delay
  const real = transport.request.bind(transport);
  const spy = jest.spyOn(transport, 'request').mockImplementation((r) =>
    r.path === '/categories' ? Promise.resolve({ status: 500, json: null }) : real(r));
  try {
    await fireEvent.press(screen.getByText('Let’s get started'));
    expect(await screen.findByText('Something went wrong. Please try again.')).toBeTruthy();
    expect(screen.queryByText('Mehendi')).toBeNull();
    spy.mockRestore();
    await fireEvent.press(screen.getAllByText('Try again')[0]);
    expect(await screen.findByText('Mehendi')).toBeTruthy();
  } finally {
    spy.mockRestore();
    queryClient.setDefaultOptions({ queries: { retry: 1, staleTime: 30_000 } });
  }
});
