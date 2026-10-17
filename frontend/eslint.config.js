const plugin = require('@next/eslint-plugin-next');
const parser = require('@typescript-eslint/parser');
const tsPlugin = require('@typescript-eslint/eslint-plugin');

module.exports = [
  {
    ignores: ['node_modules/', '.next/', 'out/'],
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: parser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      '@next/next': plugin,
    },
    rules: {
      ...plugin.flatConfig.recommended.rules,
      '@next/next/no-html-link-for-pages': 'error',
    },
  },
];
