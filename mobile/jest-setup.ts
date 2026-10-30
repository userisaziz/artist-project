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
