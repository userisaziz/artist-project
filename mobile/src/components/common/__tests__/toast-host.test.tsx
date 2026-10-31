import { AccessibilityInfo, Platform } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { ThemeProvider } from '../../../core/theme/theme-provider';
import { currentToast, dismissToast, toast } from '../../../core/toast/toast';
import { ToastHost } from '../Toast';

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 24, bottom: 0, left: 0, right: 0 }),
}));

const originalOS = Platform.OS;
const wrap = () => render(<ThemeProvider><ToastHost /></ThemeProvider>);
/** Raises a message the way a mutation `onError` would, inside a React update. */
const say = async (tone: 'success' | 'error', title: string, body?: string) => {
  await act(async () => { toast(tone, title, body); });
};

// jest-expo hands `AccessibilityInfo` an auto-mock that keeps its call history across tests.
beforeEach(() => { dismissToast(); jest.clearAllMocks(); });
afterEach(() => {
  dismissToast();
  Platform.OS = originalOS;
  jest.restoreAllMocks();
});

it('draws no card until something is said', async () => {
  await wrap();
  expect(screen.queryByRole('button')).toBeNull();
});

it('draws a message raised from anywhere, with both lines', async () => {
  await wrap();
  await say('error', 'Couldn’t update', 'Try again in a minute');
  expect(screen.getByText('Couldn’t update')).toBeTruthy();
  expect(screen.getByText('Try again in a minute')).toBeTruthy();
});

it('drops the body line for a one-sentence message', async () => {
  await wrap();
  await say('success', 'Saved');
  expect(screen.getByText('Saved')).toBeTruthy();
});

it('dismisses on tap and hands the card to the exit animation', async () => {
  await wrap();
  await say('error', 'Couldn’t update', 'Try again in a minute');

  await fireEvent.press(screen.getByRole('button', { name: 'Couldn’t update' }));
  expect(currentToast()).toBeNull();
  // The card leaves the tree at once; Reanimated plays the exit from the captured node, so the host
  // never has to keep the last message around to fade it out.
  expect(screen.queryByText('Couldn’t update')).toBeNull();
});

it('announces by hand on iOS, where a live region is not read', async () => {
  Platform.OS = 'ios';
  const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => {});
  await wrap();
  await say('error', 'Couldn’t update', 'Try again in a minute');
  expect(announce).toHaveBeenCalledWith('Couldn’t update. Try again in a minute');
});

it('leaves the reading to the live region on Android', async () => {
  Platform.OS = 'android';
  const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => {});
  await wrap();
  await say('error', 'Couldn’t update');
  expect(announce).not.toHaveBeenCalled();
});
