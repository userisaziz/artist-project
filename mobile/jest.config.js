module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['<rootDir>/jest-setup.ts'],
  // lucide's react-native entry is an .mjs build jest-expo doesn't transform; tests use its CommonJS build.
  moduleNameMapper: {
    '^lucide-react-native$': '<rootDir>/node_modules/lucide-react-native/dist/cjs/lucide-react-native.js',
    // Reanimated 4 initializes native worklets at import time; worklets' official jest mock
    // (docs.swmansion.com/react-native-worklets/docs/guides/testing) keeps tests JS-only.
    '^react-native-worklets$': 'react-native-worklets/src/mock',
  },
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@sentry/react-native|native-base|react-native-svg|standard-navigation)',
  ],
};
