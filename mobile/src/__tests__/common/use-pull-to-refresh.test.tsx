import { act, renderHook } from '@testing-library/react-native';
import { usePullToRefresh } from '../../hooks/common/use-pull-to-refresh';

it('spins while the pulled reload runs, then stops', async () => {
  let finish: () => void = () => {};
  const refetch = jest.fn(() => new Promise<void>((resolve) => { finish = resolve; }));
  const { result } = await renderHook(() => usePullToRefresh(refetch));
  expect(result.current.refreshing).toBe(false);

  await act(async () => { result.current.onRefresh(); });
  expect(result.current.refreshing).toBe(true);
  expect(refetch).toHaveBeenCalledTimes(1);

  await act(async () => { finish(); });
  expect(result.current.refreshing).toBe(false);
});

it('stops spinning when the reload fails', async () => {
  const { result } = await renderHook(() => usePullToRefresh(() => Promise.reject(new Error('offline'))));

  await act(async () => { result.current.onRefresh(); });

  expect(result.current.refreshing).toBe(false);
});
