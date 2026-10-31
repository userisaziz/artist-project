const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const boundaries = require('eslint-plugin-boundaries');

module.exports = defineConfig([
  expoConfig,
  { ignores: ['dist/*'] },
  {
    files: ['**/*.{ts,tsx}'],
    plugins: { boundaries },
    settings: {
      'boundaries/legacy-templates': false,
      'boundaries/elements': [
        // order matters: first match wins
        { type: 'test', pattern: 'src/__tests__/*', capture: ['family'] },
        { type: 'route', pattern: 'app' },
        { type: 'core', pattern: 'src/core' },
        { type: 'common', pattern: 'src/*/common', capture: ['layer'] },
        // src/<layer>/<feature> — the vertical feature slice
        { type: 'feature', pattern: 'src/*/*', capture: ['layer', 'family'] },
      ],
    },
    rules: {
      // The keyboard rule (Android already resizes the window; only iOS may pad) lives in one place.
      // Importing the primitive anywhere else is how the old three-different-recipes drift came back.
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'react-native',
              importNames: ['KeyboardAvoidingView'],
              message: 'Use src/components/common/KeyboardAvoider — it owns the platform keyboard rule.',
            },
          ],
        },
      ],
      'boundaries/dependencies': [
        'warn',
        {
          default: 'allow',
          policies: [
            // 1. No cross-feature imports: a slice may only import slices of the SAME family
            {
              from: { element: { type: 'feature' } },
              disallow: {
                to: {
                  element: {
                    type: 'feature',
                    captured: { family: '!{{ from.element.captured.family }}' },
                  },
                },
              },
            },
            // 2. Nothing may import route files — app/ assembles, it is not a dependency
            { disallow: { to: { element: { type: 'route' } } } },
            // 3. Shared code (common/, core/) must not depend on features
            {
              from: { element: { type: ['common', 'core'] } },
              disallow: { to: { element: { type: 'feature' } } },
            },
          ],
        },
      ],
    },
  },
  {
    files: ['**/components/common/KeyboardAvoider.tsx'],
    rules: { 'no-restricted-imports': 'off' },
  },
]);
