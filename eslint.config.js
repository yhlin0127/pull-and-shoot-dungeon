// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*'],
  },
  {
    files: ['jest.setup.js'],
    languageOptions: { globals: { jest: 'readonly' } },
  },
  {
    files: ['src/game/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              regex: '^(?!\\./|\\.\\./camera$)',
              message:
                'src/game imports only its own files and ../camera, never React, React Native, Skia, Reanimated, Gesture Handler, Worklets, or Expo.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/camera.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              regex: '.',
              message: 'src/game depends on camera.ts, so camera.ts stays import-free.',
            },
          ],
        },
      ],
    },
  },
]);
