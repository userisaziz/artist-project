import { act, renderHook } from '@testing-library/react-native';
import { ENTRANCE_WINDOW_MS, fadeRise, staggerDelay, useEntranceWindow } from '../motion';

beforeEach(() => {
  // React's async act() drains work through setImmediate/microtasks; faking those would
  // resolve renderHook before its effects flush, so only the timers we advance are faked.
  jest.useFakeTimers({ doNotFake: ['setImmediate', 'queueMicrotask'] });
});

afterEach(() => {
  jest.useRealTimers();
});

describe('staggerDelay', () => {
  it('steps 36ms per item', () => {
    expect(staggerDelay(0)).toBe(0);
    expect(staggerDelay(1)).toBe(36);
    expect(staggerDelay(7)).toBe(252);
  });

  it('caps after 8 items so the cascade stays inside the 500ms budget', () => {
    expect(staggerDelay(8)).toBe(0);
    expect(staggerDelay(30)).toBe(0);
  });
});

describe('useEntranceWindow', () => {
  it('stays armed while the list has no items', async () => {
    const { result, rerender } = await renderHook(({ hasItems }: { hasItems: boolean }) => useEntranceWindow(hasItems), {
      initialProps: { hasItems: false },
    });
    expect(result.current).toBe(true);
    // RNTL's act() is async; awaiting it is what flushes hook state to result.current.
    await act(async () => {
      jest.advanceTimersByTime(10_000);
    });
    expect(result.current).toBe(true);
    await act(async () => {
      rerender({ hasItems: false });
    });
    expect(result.current).toBe(true);
  });

  it('closes the window after the entrance budget so recycled rows never replay', async () => {
    const { result } = await renderHook(() => useEntranceWindow(true));
    expect(result.current).toBe(true);
    await act(async () => {
      jest.advanceTimersByTime(ENTRANCE_WINDOW_MS);
    });
    expect(result.current).toBe(false);
  });
});

describe('fadeRise', () => {
  it('returns an entrance for both the full and reduced-motion variants', () => {
    expect(fadeRise(36, false)).toBeTruthy();
    expect(fadeRise(36, true)).toBeTruthy();
  });
});
