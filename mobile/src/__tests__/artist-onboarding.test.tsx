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
  expect(screen.getByLabelText('Step 1 of 3')).toBeTruthy();
  mockPicks(1);
  await fireEvent.press(screen.getByLabelText('Add profile photo'));
  expect(await screen.findByLabelText('Change profile photo')).toBeTruthy();
  await fireEvent.changeText(screen.getByLabelText('Business name'), 'Ayesha Mehendi Art');
  await fireEvent.press(await screen.findByText('Mehendi'));
  await fireEvent.press(screen.getByLabelText('City'));
  await fireEvent.press(await screen.findByText('Bangalore'));
  await fireEvent.press(screen.getByText('Continue'));
  expect(await screen.findByLabelText('Step 2 of 3')).toBeTruthy();
}

it('Intro → Profile saves a draft and moves on to Services', async () => {
  await startArtist('9845044441');
  expect(screen.getByText('3 short steps')).toBeTruthy();
  expect(screen.queryByText(/every Monday/)).toBeNull();
  await fillProfile();
});

it('Profile Continue stays disabled until photo, name, a category and a city are set', async () => {
  await startArtist('9845044442');
  await fireEvent.press(screen.getByText('Let’s get started'));
  await fireEvent.changeText(await screen.findByLabelText('Business name'), 'Studio');
  await fireEvent.press(await screen.findByText('Makeup'));
  await fireEvent.press(screen.getByText('Continue'));
  expect(screen.queryByLabelText('Step 2 of 3')).toBeNull(); // no photo or city yet
});

/** Services: add "Bridal mehendi" (₹4,500, 180 min) through the sheet. */
async function addService() {
  await fireEvent.press(screen.getByText('+ Add service'));
  await fireEvent.changeText(await screen.findByLabelText('Service name'), 'Bridal mehendi');
  await fireEvent.changeText(screen.getByLabelText('Price (₹)'), '4500');
  await fireEvent.changeText(screen.getByLabelText('Duration (minutes)'), '180');
  await fireEvent.press(screen.getByText('Save service'));
  expect(await screen.findByText('Bridal mehendi')).toBeTruthy();
  expect(screen.getByText('Mehendi · ₹4,500 · 3 hr')).toBeTruthy();
}

it('Services: Continue needs a service; services can be added and removed', async () => {
  await startArtist('9845044443');
  await fillProfile();
  expect(screen.getByText('Set your prices')).toBeTruthy();
  await fireEvent.press(screen.getByText('Continue'));
  expect(screen.queryByLabelText('Step 3 of 3')).toBeNull();

  await addService();
  await fireEvent.press(screen.getByLabelText('Remove Bridal mehendi'));
  await waitFor(() => expect(screen.queryByText('Bridal mehendi')).toBeNull());

  await addService();
  await fireEvent.press(screen.getByText('Continue'));
  expect(await screen.findByLabelText('Step 3 of 3')).toBeTruthy();
});

it('the Add service sheet rejects a zero price before calling the server', async () => {
  await startArtist('9845044444');
  await fillProfile();
  await fireEvent.press(screen.getByText('+ Add service'));
  await fireEvent.changeText(await screen.findByLabelText('Service name'), 'Trial');
  await fireEvent.changeText(screen.getByLabelText('Price (₹)'), '0');
  await fireEvent.changeText(screen.getByLabelText('Duration (minutes)'), '30');
  await fireEvent.press(screen.getByText('Save service'));
  expect(await screen.findByText('Enter a price above ₹0.')).toBeTruthy();
});

/** Portfolio: pick and upload `n` photos in one go; waits until `total` tiles are on screen. */
async function addPhotos(n: number, total = n) {
  mockPicks(n);
  await fireEvent.press(screen.getByLabelText('Add photos'));
  await waitFor(() => expect(screen.queryAllByLabelText(/^Portfolio photo \d+$/)).toHaveLength(total), { timeout: 5000 });
}

it('Portfolio: counts toward six, marks the cover, Make cover and Remove work, then submit lands on In review', async () => {
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
  await fireEvent.press(await screen.findByText('Submit for review'));
  expect(await screen.findByText('Your profile is in review')).toBeTruthy();
  expect(screen.getByText('Profile submitted')).toBeTruthy();
});

const mock = transport as MockTransport;

/** Runs the whole flow to In review for a fresh number. */
async function submitFor(national: string) {
  await startArtist(national);
  await fillProfile();
  await addService();
  await fireEvent.press(screen.getByText('Continue'));
  await addPhotos(6);
  await fireEvent.press(await screen.findByText('Submit for review'));
  expect(await screen.findByText('Your profile is in review')).toBeTruthy();
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
  expect(await screen.findByText('Bridal mehendi')).toBeTruthy();
  await fireEvent.press(screen.getByText('Continue'));
  await fireEvent.press(await screen.findByText('Submit for review'));
  expect(await screen.findByText('Your profile is in review')).toBeTruthy();
});

it('approval moves the artist to the home', async () => {
  await submitFor('9845044447');
  mock.review('+919845044447', 'approved');
  await queryClient.invalidateQueries({ queryKey: ['artist'] });
  expect(await screen.findByText('Welcome, Ayesha')).toBeTruthy();
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
