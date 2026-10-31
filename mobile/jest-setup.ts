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
