import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';
import noDirectUIInteraction from './eslint-rules/no-direct-ui-interaction.mjs';

export default [
  {
    files: ['tests/**/*.spec.ts', 'tests/**/*.test.ts'],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
      'custom': {
        rules: {
          'no-direct-ui-interaction': noDirectUIInteraction,
        },
      },
    },
    rules: {
      'custom/no-direct-ui-interaction': 'error',
    },
  },
];
