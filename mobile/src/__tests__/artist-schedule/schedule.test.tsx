import type { ReactElement } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '../../core/theme/theme-provider';
import { transport } from '../../core/api/client';
import type { TransportRequest } from '../../core/api/transport';
import { WorkingHoursForm } from '../../components/artist-schedule/WorkingHoursForm';
import { DayOffToggle } from '../../components/artist-schedule/DayOffToggle';
import { Storefront } from '../../components/directory/Storefront';
import { hoursSummary, type WeeklyHour } from '../../utils/common/weekly-hours';
import type { Schedule } from '../../types/artist-schedule/artist-schedule';
import type { ArtistPublic } from '../../types/directory/directory';

jest.mock('../../context/auth/auth-provider', () => ({
  useAuth: () => ({ user: jest.requireActual('../../mocks/auth/auth').userFixture }),
}));
jest.mock('expo-router', () => ({ useRouter: () => ({ back: jest.fn(), push: jest.fn() }), useIsFocused: () => true }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));

jest.setTimeout(20_000);

// Mirrors backend ScheduleOut: every day 8:00-20:00 until the artist changes it.
const week = (over: Partial<Record<number, Partial<WeeklyHour>>> = {}): WeeklyHour[] =>
  Array.from({ length: 7 }, (_, weekday) => ({ weekday, is_open: true, open_hour: 8, close_hour: 20, ...over[weekday] }));
const schedule = (over: Partial<Schedule> = {}): Schedule => ({ hours: week(), days_off: ['2030-11-02'], travel_radius_km: null, ...over });

const NO_REVIEWS = { average: null, count: 0, distribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 } };
const send = jest.spyOn(transport, 'request');
let client: QueryClient;
const wrap = (ui: ReactElement) => render(<QueryClientProvider client={client}><ThemeProvider>{ui}</ThemeProvider></QueryClientProvider>);
function serve(routes: Record<string, unknown>) {
  send.mockImplementation(async (req: TransportRequest) => {
    const key = `${req.method} ${req.path}`;
    const route = routes[key];
    if (route === undefined) return { status: 200, json: { items: [], next_cursor: null, summary: NO_REVIEWS } }; // lists the screen also reads
    return (typeof route === 'function' ? (route as (r: TransportRequest) => unknown)(req) : { status: 200, json: route }) as { status: number; json: unknown };
  });
}

beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false } } });
  send.mockReset();
});
afterEach(() => client.clear());
afterAll(() => send.mockRestore());

it('summarises a week, merging days with the same hours', () => {
  expect(hoursSummary(week({ 5: { open_hour: 10, close_hour: 16 }, 6: { is_open: false } }))).toEqual(['Mon–Fri 8:00–20:00', 'Sat 10:00–16:00', 'Sun Closed']);
});

it('the artist sets hours per day and a travel radius, and removes a day off', async () => {
  const saved: unknown[] = [];
  serve({
    'GET /artists/me/schedule': schedule(),
    'PUT /artists/me/schedule': (req: TransportRequest) => { saved.push(req.body); return { status: 200, json: schedule(req.body as Partial<Schedule>) }; },
    'DELETE /artists/me/schedule/days-off/2030-11-02': () => ({ status: 200, json: schedule({ days_off: [] }) }),
  });
  await wrap(<WorkingHoursForm />);

  await fireEvent(await screen.findByLabelText('Sunday open'), 'valueChange', false);
  await fireEvent.press(screen.getByRole('button', { name: 'Mon opens later' }));
  await fireEvent.changeText(screen.getByLabelText('Travel radius in km (optional)'), '15');
  await fireEvent.press(screen.getByRole('button', { name: 'Save hours' }));

  await waitFor(() => expect(saved).toHaveLength(1));
  expect(saved[0]).toEqual({ hours: week({ 0: { open_hour: 9 }, 6: { is_open: false } }), travel_radius_km: 15 });

  await fireEvent.press(screen.getByRole('button', { name: /Remove day off/ }));
  expect(await screen.findByText('No days off coming up. Mark one from the Calendar.')).toBeTruthy();
});

it('a radius outside 1-100 km blocks saving, and a failed save says why', async () => {
  serve({
    'GET /artists/me/schedule': schedule(),
    'PUT /artists/me/schedule': { status: 422, json: { code: 'validation_error', message: 'Close after you open' } },
  });
  await wrap(<WorkingHoursForm />);

  await fireEvent.changeText(await screen.findByLabelText('Travel radius in km (optional)'), '250');
  expect(screen.getByText('Travel radius is a whole number from 1 to 100 km')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Save hours' })).toBeDisabled();

  await fireEvent.changeText(screen.getByLabelText('Travel radius in km (optional)'), '');
  send.mockImplementationOnce(async () => ({ status: 422, json: { code: 'validation_error', message: 'Close after you open' } }));
  await fireEvent.press(screen.getByRole('button', { name: 'Save hours' }));
  expect(await screen.findByText('Close after you open')).toBeTruthy();
});

it('the calendar takes a day off', async () => {
  const added: string[] = [];
  serve({
    'GET /artists/me/schedule': schedule({ days_off: [] }),
    'PUT /artists/me/schedule/days-off/2030-11-05': (req: TransportRequest) => { added.push(req.path); return { status: 200, json: schedule({ days_off: ['2030-11-05'] }) }; },
  });
  await wrap(<DayOffToggle day="2030-11-05" today="2030-11-01" />);

  await fireEvent(await screen.findByLabelText('Day off'), 'valueChange', true);
  await waitFor(() => expect(added).toHaveLength(1));
  expect(await screen.findByText('Clients can’t book this day. Existing bookings stay.')).toBeTruthy();
});

it('the storefront shows the artist’s hours and how far they travel', async () => {
  const artist: ArtistPublic = {
    id: 'a1', business_name: 'Ayesha Mehendi Art', city: 'Bangalore', photo_url: null, cover_url: null,
    categories: [{ id: 1, name: 'Mehendi' }], from_price_paise: 350000, rating: 4.9, review_count: 86, bio: null, experience_years: null, languages: [], photos: [], services: [],
    member_since: '2026-01-10T00:00:00Z', completed_bookings: 12, hours: week({ 6: { is_open: false } }), travel_radius_km: 15,
    next_free_date: null, reply_minutes: null, locality: null, photo_urls: [], distance_km: null, free_on: null,
  } as ArtistPublic;
  serve({ 'GET /artists/a1': artist });
  await wrap(<Storefront artistId="a1" />);

  expect(await screen.findByText('Mon–Sat 8:00–20:00')).toBeTruthy();
  expect(screen.getByText('Sun Closed')).toBeTruthy();
  expect(screen.getByText('Travels up to 15 km')).toBeTruthy();
});
