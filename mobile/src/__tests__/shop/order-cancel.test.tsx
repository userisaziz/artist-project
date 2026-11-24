import type { ReactElement } from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '../../core/theme/theme-provider';
import { transport } from '../../core/api/client';
import type { TransportRequest } from '../../core/api/transport';
import { OrderDetail } from '../../components/shop/OrderDetail';
import { orderFixture } from '../../mocks/shop/shop';

jest.mock('../../context/auth/auth-provider', () => ({
  useAuth: () => ({ user: jest.requireActual('../../mocks/auth/auth').userFixture }),
}));
jest.mock('expo-router', () => ({ useRouter: () => ({ back: jest.fn(), push: jest.fn() }) }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));

const send = jest.spyOn(transport, 'request');
const posts: TransportRequest[] = [];
let client: QueryClient;
const wrap = (ui: ReactElement) => render(<QueryClientProvider client={client}><ThemeProvider>{ui}</ThemeProvider></QueryClientProvider>);

beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  send.mockReset();
  posts.length = 0;
  const order = orderFixture({ status: 'placed' });
  send.mockImplementation(async (req: TransportRequest) => {
    if (req.method === 'POST') { posts.push(req); return { status: 200, json: { ...order, status: 'cancelled', cancelled_by: 'customer' } }; }
    return { status: 200, json: order };
  });
});
afterEach(() => client.clear());
afterAll(() => send.mockRestore());

it('asks before cancelling an order and sends the reason', async () => {
  const order = orderFixture({ status: 'placed' });
  await wrap(<OrderDetail orderId={order.id} />);
  await fireEvent.press(await screen.findByRole('button', { name: 'Cancel order' }));
  expect(posts).toHaveLength(0); // one tap only opens the confirmation

  await fireEvent.press(screen.getByRole('button', { name: 'Keep order' }));
  expect(screen.getByRole('button', { name: 'Cancel order' })).toBeTruthy();
  expect(posts).toHaveLength(0);

  await fireEvent.press(screen.getByRole('button', { name: 'Cancel order' }));
  await fireEvent.changeText(screen.getByPlaceholderText('Tell the seller why'), 'Ordered the wrong size');
  await fireEvent.press(screen.getByRole('button', { name: 'Yes, cancel' }));
  expect(posts[0]).toMatchObject({ method: 'POST', body: { reason: 'Ordered the wrong size' } });
});
