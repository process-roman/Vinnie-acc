// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const prettierConfig = require('eslint-config-prettier');

module.exports = defineConfig([
  expoConfig,
  prettierConfig,
  {
    ignores: ['dist/*', 'public/*'],
  },
  {
    // Build scripts run under Node.
    files: ['scripts/**/*.js', 'promo/**/*.ts'],
    languageOptions: {
      globals: {
        __dirname: 'readonly',
        require: 'readonly',
        process: 'readonly',
        Buffer: 'readonly',
      },
    },
  },
  {
    // The website's serverless function.
    files: ['api/**/*.js'],
    languageOptions: {
      globals: { module: 'writable', process: 'readonly', fetch: 'readonly', console: 'readonly' },
    },
  },
  {
    // The landing page's script, in the browser.
    files: ['site/**/*.js'],
    languageOptions: {
      globals: {
        window: 'readonly',
        document: 'readonly',
        localStorage: 'readonly',
        fetch: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
      },
    },
  },
]);
