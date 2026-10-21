import { useState, type ReactElement } from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '../../core/theme/theme-provider';
import { transport } from '../../core/api/client';
import type { TransportRequest } from '../../core/api/transport';
import { SlotPicker } from '../../components/directory/SlotPicker';

const send = jest.spyOn(transport, 'request');
let client: QueryClient;
const wrap = (ui: ReactElement) => render(<QueryClientProvider client={client}><ThemeProvider>{ui}</ThemeProvider></QueryClientProvider>);
const picked: (string | null)[] = [];

function Harness() {
  const [value, setValue] = useState<string | null>(null);
  return <SlotPicker artistId="a1" serviceId="s1" value={value} onChange={(v) => { picked.push(v); setValue(v); }} />;
}

beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  picked.length = 0;
  send.mockReset();
  // Mirrors GET /artists/{id}/availability: hourly IST slots, taken ones unavailable.
  send.mockImplementation(async (req: TransportRequest) => {
    const date = new URLSearchParams(req.path.split('?')[1]).get('date') ?? '';
    return { status: 200, json: { date, slots: [
      { start_at: `${date}T10:00:00+05:30`, available: true },
      { start_at: `${date}T11:00:00+05:30`, available: false },
    ] } };
  });
});
afterEach(() => client.clear());
afterAll(() => send.mockRestore());

it('picks an open time; taken ones cannot be picked; a new day clears the pick', async () => {
  await wrap(<Harness />);

  await fireEvent.press(await screen.findByRole('button', { name: '10:00 AM, available' }));
  expect(screen.getByRole('button', { name: '11:00 AM, taken' })).toBeDisabled();
  expect(picked).toHaveLength(1);
  expect(picked[0]).toMatch(/T10:00:00\+05:30$/);

  const days = screen.getAllByRole('button').filter((b) => /^[A-Z][a-z]{2}, \d+ [A-Z][a-z]{2}$/.test(b.props.accessibilityLabel ?? ''));
  await fireEvent.press(days[1]);
  expect(picked.at(-1)).toBeNull();
  expect(send.mock.calls.map(([r]) => r.path).every((p) => p.includes('service_id=s1'))).toBe(true);
});
