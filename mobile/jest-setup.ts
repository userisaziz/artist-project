import * as fs from 'fs';
for (const file of ['.env.test', '.env']) {
  if (fs.existsSync(file)) {
    for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
      const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
      if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^"|"$/g, '');
    }
  }
}

// Reanimated's jest mock keeps worklet APIs (withTiming/withSpring/useAnimatedStyle/entry animations)
// synchronous in tests. Must stay in sync with the installed major version — expo install pins it.
require('react-native-reanimated').setUpTests();

// Haptics have no JS implementation to run: the buzz is a device call. Mocked here so every component
// that buzzes on press stays importable, and `core/motion/haptics` can be asserted on directly.
jest.mock('expo-haptics', () => {
  const noop = () => Promise.resolve();
  return {
    impactAsync: jest.fn(noop),
    selectionAsync: jest.fn(noop),
    notificationAsync: jest.fn(noop),
    ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
    NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' },
  };
});

// A toast raised by a test arms a 4s dismissal timer; left alone it outlives the test (and the suite).
afterEach(() => {
  require('./src/core/toast/toast').dismissToast();
});

// FlashList headless setup — hand-rolled because the official `@shopify/flash-list/jestSetup`
// shipped in 2.0.2 mocks `FlashList` to `requireActual(...).RecyclerView`, an export that
// version's index omits (undefined element type). We point at the RecyclerView implementation
// directly and stub its native layout measurement, matching the official setup's intent.
// Remove this block once the SDK-pinned flash-list ships jestSetup that works.
jest.mock('@shopify/flash-list', () => ({
  ...jest.requireActual('@shopify/flash-list'),
  FlashList: jest.requireActual('@shopify/flash-list/dist/recyclerview/RecyclerView').RecyclerView,
}));
jest.mock('@shopify/flash-list/dist/recyclerview/utils/measureLayout', () => ({
  ...jest.requireActual('@shopify/flash-list/dist/recyclerview/utils/measureLayout'),
  measureParentSize: jest.fn().mockImplementation(() => ({ x: 0, y: 0, width: 400, height: 900 })),
  measureFirstChildLayout: jest.fn().mockImplementation(() => ({ x: 0, y: 0, width: 400, height: 900 })),
  measureItemLayout: jest.fn().mockImplementation(() => ({ x: 0, y: 0, width: 100, height: 100 })),
}));
