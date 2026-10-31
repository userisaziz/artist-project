import { Keyboard, Platform, StyleSheet, Text, type KeyboardEvent } from 'react-native';
import { act, render, type RenderResult } from '@testing-library/react-native';
import { KeyboardAvoider } from '../../components/common/KeyboardAvoider';

const originalOS = Platform.OS;
afterEach(() => {
  Platform.OS = originalOS;
  jest.restoreAllMocks();
});

// Keyboard metrics as the platform reports them on a 390x844 phone once the keyboard is up: its top
// edge sits at y=584, so a full-height frame needs 260 of compensation — but only where the OS does
// not already give the window away.
const SHOW = {
  duration: 0,
  easing: 'keyboard',
  endCoordinates: { screenX: 0, screenY: 584, width: 390, height: 260 },
};

/** Captures KeyboardAvoidingView's own subscriptions, so a test can raise the keyboard without a device. */
function captureKeyboard() {
  const handlers: Record<string, (event: KeyboardEvent) => void> = {};
  jest.spyOn(Keyboard, 'addListener').mockImplementation(((event: string, handler: (event: KeyboardEvent) => void) => {
    handlers[event] = handler;
    return { remove: () => { delete handlers[event]; } };
  }) as unknown as typeof Keyboard.addListener);
  jest.spyOn(Keyboard, 'isVisible').mockReturnValue(false);
  return handlers;
}

const frameOf = (view: RenderResult) => StyleSheet.flatten(view.getByTestId('frame').props.style) as Record<string, unknown>;

/** Tells the frame its on-screen height, then raises the keyboard the way the platform does. */
async function raiseKeyboard(view: RenderResult, handlers: Record<string, (event: KeyboardEvent) => void>) {
  const layoutEvent = {
    persist: () => {}, // KeyboardAvoidingView's _onLayout calls it; the test event has to carry it
    nativeEvent: { layout: { x: 0, y: 0, width: 390, height: 844 } },
  };
  const show = handlers[Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow'];
  // Both the measure and the keyboard arrival settle their work on later ticks, so the whole exchange
  // runs in one scope and nothing lands after the test ends.
  await act(async () => {
    await view.getByTestId('frame').props.onLayout(layoutEvent);
    show?.(SHOW as KeyboardEvent);
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

it('keeps the child in the tree and fills the screen', async () => {
  Platform.OS = 'android';
  const view = await render(<KeyboardAvoider testID="frame"><Text>Checkout</Text></KeyboardAvoider>);

  expect(view.getByText('Checkout')).toBeOnTheScreen();
  expect(frameOf(view).flex).toBe(1);
});

it('pads on Android too, because edge-to-edge no longer resizes the window for the IME', async () => {
  Platform.OS = 'android';
  const handlers = captureKeyboard();
  const view = await render(<KeyboardAvoider testID="frame"><Text>Checkout</Text></KeyboardAvoider>);

  await raiseKeyboard(view, handlers);

  // adjustResize is a no-op under edge-to-edge: without this the footer button sits behind the keyboard.
  expect(frameOf(view).paddingBottom).toBe(260);
});

it('pads the frame on iOS, where nothing resizes the window', async () => {
  Platform.OS = 'ios';
  const handlers = captureKeyboard();
  const view = await render(<KeyboardAvoider testID="frame"><Text>Checkout</Text></KeyboardAvoider>);

  await raiseKeyboard(view, handlers);

  expect(frameOf(view).paddingBottom).toBe(260);
});

it('leaves web behaviourless, since there is no soft keyboard to reserve for', async () => {
  Platform.OS = 'web';
  const handlers = captureKeyboard();
  const view = await render(<KeyboardAvoider testID="frame"><Text>Checkout</Text></KeyboardAvoider>);

  await raiseKeyboard(view, handlers);

  expect(frameOf(view).paddingBottom).toBeUndefined();
});
