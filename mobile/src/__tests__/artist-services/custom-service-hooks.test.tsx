import type { ReactNode } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAddCustomService, useDeleteCustomService, useUpdateCustomService } from '../../hooks/artist-services/artist-services';
import { transport } from '../../core/api/client';
import { ApiError } from '../../core/api/types';
import type { TransportRequest } from '../../core/api/transport';
import { artistProfileFixture, customServiceFixture } from '../../mocks/artist-onboarding/artist-onboarding';

const send = jest.spyOn(transport, 'request');
const profileKey = ['artist', 'me', 'user-1'];
let client: QueryClient;
const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
const sent = (): TransportRequest => send.mock.calls[0][0];

beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity }, mutations: { retry: false, gcTime: Infinity } } });
  client.setQueryData(profileKey, artistProfileFixture());
  send.mockReset();
});
afterEach(() => client.clear());
afterAll(() => send.mockRestore());

it('adding a custom service posts it and caches the returned profile', async () => {
  const updated = artistProfileFixture({ services: [customServiceFixture] });
  send.mockResolvedValue({ status: 201, json: updated });
  const { result } = await renderHook(() => useAddCustomService(), { wrapper });

  const input = { subcategory_id: 12, name: 'Saree draping', price_paise: 80_000, duration_minutes: 45 };
  await act(async () => { await result.current.mutateAsync(input); });
  await waitFor(() => expect(result.current.isSuccess).toBe(true));

  expect(sent()).toMatchObject({ method: 'POST', path: '/artists/me/custom-services', body: input });
  expect(client.getQueryData(profileKey)).toEqual(updated);
});

it('editing a custom service patches it by id', async () => {
  send.mockResolvedValue({ status: 200, json: artistProfileFixture({ services: [customServiceFixture] }) });
  const { result } = await renderHook(() => useUpdateCustomService(), { wrapper });

  await act(async () => { await result.current.mutateAsync({ id: customServiceFixture.id, input: { price_paise: 90_000 } }); });
  await waitFor(() => expect(result.current.isSuccess).toBe(true));

  expect(sent()).toMatchObject({ method: 'PATCH', path: `/artists/me/custom-services/${customServiceFixture.id}`, body: { price_paise: 90_000 } });
});

it('a failed delete surfaces the ApiError and leaves the cached profile alone', async () => {
  const before = client.getQueryData(profileKey);
  send.mockResolvedValue({ status: 404, json: { code: 'not_found', message: 'Resource not found' } });
  const { result } = await renderHook(() => useDeleteCustomService(), { wrapper });

  let error: unknown;
  await act(async () => { error = await result.current.mutateAsync(customServiceFixture.id).catch((e: unknown) => e); });
  await waitFor(() => expect(result.current.isError).toBe(true));

  expect(error).toBeInstanceOf(ApiError);
  expect(error).toMatchObject({ code: 'not_found', status: 404 });
  expect(client.getQueryData(profileKey)).toBe(before);
});
