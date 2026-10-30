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

  it('stays closed when the list empties and repopulates, so refetches never replay', async () => {
    const { result, rerender } = await renderHook(({ hasItems }: { hasItems: boolean }) => useEntranceWindow(hasItems), {
      initialProps: { hasItems: true },
    });
    await act(async () => {
      jest.advanceTimersByTime(ENTRANCE_WINDOW_MS);
    });
    expect(result.current).toBe(false);
    await act(async () => {
      rerender({ hasItems: false });
    });
    await act(async () => {
      rerender({ hasItems: true });
    });
    expect(result.current).toBe(false);
  });
});

describe('fadeRise', () => {
  it('full variant: enter duration with the stagger delay applied', () => {
    const full = fadeRise(36, false) as { durationV?: number; delayV?: number };
    expect(full.durationV).toBe(320); // motionDurations.enter
    expect(full.delayV).toBe(36);
  });

  it('reduced variant: quick plain fade with no travel and no delay', () => {
    const reduced = fadeRise(36, true) as { durationV?: number; delayV?: number; constructor: { name: string } };
    expect(reduced.durationV).toBe(120); // motionDurations.quick
    expect(reduced.delayV).toBeUndefined();
    expect(reduced.constructor.name).toBe('FadeIn'); // not FadeInDown → no 12px travel
  });
});
