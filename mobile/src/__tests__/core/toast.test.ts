import { currentToast, dismissToast, toast } from '../../core/toast/toast';

beforeEach(() => {
  jest.useFakeTimers();
  dismissToast();
});
afterEach(() => {
  dismissToast(); // clears whatever timer the test left armed, so jest exits
  jest.useRealTimers();
});

it('holds a message until its time is up, then takes it back on its own', () => {
  toast('error', 'Couldn’t update', 'Try again in a minute');
  expect(currentToast()).toMatchObject({ tone: 'error', title: 'Couldn’t update', body: 'Try again in a minute' });
  jest.advanceTimersByTime(3999);
  expect(currentToast()).not.toBeNull();
  jest.advanceTimersByTime(1);
  expect(currentToast()).toBeNull();
});

it('replaces the message on screen instead of queueing a second card', () => {
  toast('error', 'Couldn’t update');
  const first = currentToast()?.id;
  toast('success', 'Thanks for telling us', 'Our team will take a look.');
  expect(currentToast()).toMatchObject({ tone: 'success', title: 'Thanks for telling us' });
  expect(currentToast()?.id).not.toBe(first);
});

it('restarts the clock for the newer message rather than expiring on the older one', () => {
  toast('error', 'First');
  jest.advanceTimersByTime(3000);
  toast('error', 'Second');
  jest.advanceTimersByTime(3000); // 6s after the first raise, 3s after the second
  expect(currentToast()).toMatchObject({ title: 'Second' });
  jest.advanceTimersByTime(1000);
  expect(currentToast()).toBeNull();
});

it('dismissing clears at once and cancels the timer behind it', () => {
  toast('success', 'Saved');
  dismissToast();
  expect(currentToast()).toBeNull();
  jest.advanceTimersByTime(4000); // nothing comes back, so the old timer was cancelled
  expect(currentToast()).toBeNull();
});

it('gives every message a new id, so repeating the same words still re-renders', () => {
  toast('error', 'Couldn’t update');
  const first = currentToast()?.id;
  toast('error', 'Couldn’t update');
  expect(currentToast()?.id).not.toBe(first);
});
