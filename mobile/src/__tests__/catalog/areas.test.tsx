import type { ReactNode } from 'react';
import { renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAreas, useNearestArea } from '../../hooks/catalog/catalog';
import { transport } from '../../core/api/client';
import type { TransportRequest } from '../../core/api/transport';
import type { Area } from '../../types/catalog/catalog';

// Mirrors backend GET /areas and GET /areas/nearest (app/catalog/router.py).
const btm: Area = { id: 8, city: 'Bangalore', name: 'BTM Layout', latitude: 12.9166, longitude: 77.6101 };
const koramangala: Area = { id: 21, city: 'Bangalore', name: 'Koramangala', latitude: 12.9352, longitude: 77.6245 };

const send = jest.spyOn(transport, 'request');
let client: QueryClient;
const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;

function serve(routes: Record<string, unknown>) {
  send.mockImplementation(async (req: TransportRequest) => {
    const key = `${req.method} ${req.path}`;
    if (!(key in routes)) throw new Error(`unexpected request ${key}`);
    return { status: 200, json: routes[key] };
  });
}

beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  send.mockReset();
});
afterEach(() => client.clear());
afterAll(() => send.mockRestore());

it('lists a city’s areas, and asks for none until the city is known', async () => {
  serve({ 'GET /areas?city=Bangalore': [btm, koramangala] });

  const none = await renderHook(() => useAreas(null), { wrapper });
  const bangalore = await renderHook(() => useAreas('Bangalore'), { wrapper });

  await waitFor(() => expect(bangalore.result.current.data).toEqual([btm, koramangala]));
  expect(none.result.current.fetchStatus).toBe('idle');
  expect(send).toHaveBeenCalledTimes(1);
});

it('finds the area a pin is in, and null outside every area', async () => {
  serve({
    'GET /areas/nearest?lat=12.918&lng=77.612': btm,
    'GET /areas/nearest?lat=13.5&lng=77': null,
  });

  const near = await renderHook(() => useNearestArea({ latitude: 12.918, longitude: 77.612 }), { wrapper });
  const far = await renderHook(() => useNearestArea({ latitude: 13.5, longitude: 77 }), { wrapper });
  const noPin = await renderHook(() => useNearestArea(null), { wrapper });

  await waitFor(() => expect(near.result.current.data).toEqual(btm));
  await waitFor(() => expect(far.result.current.isSuccess).toBe(true));
  expect(far.result.current.data).toBeNull();
  expect(noPin.result.current.fetchStatus).toBe('idle');
});
