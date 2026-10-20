import type { ReactNode } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAddService, useDeleteService, useSaveProfile } from '../../hooks/artist-onboarding/artist-onboarding';
import { transport } from '../../core/api/client';
import type { TransportRequest } from '../../core/api/transport';
import { artistProfileFixture, templateServiceFixture } from '../../mocks/artist-onboarding/artist-onboarding';
import { userFixture } from '../../mocks/auth/auth';

jest.mock('../../context/auth/auth-provider', () => ({
  useAuth: () => ({ user: jest.requireActual('../../mocks/auth/auth').userFixture }),
}));

const send = jest.spyOn(transport, 'request');
const profileKey = ['artist', 'me', userFixture.id];
let client: QueryClient;
const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
const sent = (): TransportRequest => send.mock.calls[0][0];

beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity }, mutations: { retry: false, gcTime: Infinity } } });
  send.mockReset();
});
afterEach(() => client.clear());
afterAll(() => send.mockRestore());

it('saving the profile PUTs it and caches the returned profile', async () => {
  const saved = artistProfileFixture({ status: 'draft', services: [] });
  send.mockResolvedValue({ status: 200, json: saved });
  const { result } = await renderHook(() => useSaveProfile(), { wrapper });

  const input = { business_name: 'Asha Bridal Studio', city: 'Bengaluru', category_ids: [1], photo_key: 'artists/9a8b/photo.jpg' };
  await act(async () => { await result.current.mutateAsync(input); });
  await waitFor(() => expect(result.current.isSuccess).toBe(true));

  expect(sent()).toMatchObject({ method: 'PUT', path: '/artists/me/profile', body: input });
  expect(client.getQueryData(profileKey)).toEqual(saved);
});

it('adding a service posts the template choice and caches the result', async () => {
  const saved = artistProfileFixture();
  send.mockResolvedValue({ status: 201, json: saved });
  const { result } = await renderHook(() => useAddService(), { wrapper });

  await act(async () => { await result.current.mutateAsync({ template_id: 3, price_paise: 1_500_000, duration_minutes: 120 }); });
  await waitFor(() => expect(result.current.isSuccess).toBe(true));

  expect(sent()).toMatchObject({ method: 'POST', path: '/artists/me/services' });
  expect(client.getQueryData(profileKey)).toEqual(saved);
});

it('a failed service delete rejects with the server message and keeps the cache', async () => {
  const before = artistProfileFixture();
  client.setQueryData(profileKey, before);
  send.mockResolvedValue({ status: 409, json: { code: 'conflict', message: 'You need at least one service' } });
  const { result } = await renderHook(() => useDeleteService(), { wrapper });

  let error: unknown;
  await act(async () => { error = await result.current.mutateAsync(templateServiceFixture.id).catch((e: unknown) => e); });
  await waitFor(() => expect(result.current.isError).toBe(true));

  expect(error).toMatchObject({ code: 'conflict', message: 'You need at least one service' });
  expect(client.getQueryData(profileKey)).toBe(before);
});
