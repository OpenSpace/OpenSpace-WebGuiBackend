import { tsLint } from '@openspace/shared-configs/eslint';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['dist/', 'node_modules/', 'uploads/', 'projects/', 'eslint.config.mjs']
  },
  {
    files: ['**/*.js'],
    extends: [tsLint],
    languageOptions: {
      ecmaVersion: 2020,
      sourceType: 'commonjs',
      globals: globals.node
    },
    rules: {
      'no-console': 'warn',
      // The sources are CommonJS modules, which load their dependencies with `require`
      '@typescript-eslint/no-require-imports': 'off'
    }
  }
);
