import globals from 'globals';
import eslintConfigPrettier from 'eslint-config-prettier';
import simpleImportSort from 'eslint-plugin-simple-import-sort';
import tseslint from 'typescript-eslint';
import js from '@eslint/js';

export default tseslint.config(
  { ignores: ['dist'] },
  {
    extends: [
      js.configs.recommended,
      ...tseslint.configs.recommended,
      eslintConfigPrettier
    ],
    files: ['**/*.ts'],
    ignores: ['**/*.d.ts'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.node
    },
    plugins: {
      'simple-import-sort': simpleImportSort
    },
    linterOptions: {
      reportUnusedDisableDirectives: 'error'
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      'no-duplicate-imports': 'error',
      'prefer-destructuring': ['error', { object: true, array: false }],
      'simple-import-sort/imports': 'error',
      'simple-import-sort/exports': 'error',
      // Guards against stupidity
      'no-self-compare': 'error',
      'no-unreachable-loop': 'error',
      'no-template-curly-in-string': 'error',
      'default-case': ['error', { commentPattern: '^skip\\sdefault' }],
      'default-case-last': 'error'
    }
  }
);
