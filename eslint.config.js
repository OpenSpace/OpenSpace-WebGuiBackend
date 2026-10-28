const globals = require('globals');
const eslintConfigPrettier = require('eslint-config-prettier');
const simpleImportSort = require('eslint-plugin-simple-import-sort');
const js = require('@eslint/js');

module.exports = [
  js.configs.recommended,
  eslintConfigPrettier,
  { ignores: ['dist', 'uploads', 'projects'] },
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 2020,
      sourceType: 'commonjs',
      globals: globals.node
    },
    linterOptions: {
      reportUnusedDisableDirectives: 'error'
    },
    plugins: {
      'simple-import-sort': simpleImportSort
    },
    rules: {
      'no-duplicate-imports': 'error', // Imports should be on one line
      'no-console': 'warn',
      'prefer-destructuring': ['error', { object: true, array: true }],
      'simple-import-sort/imports': [
        'error',
        {
          groups: [
            // Packages `react` related packages come first.
            ['^react', '^@?\\w'],
            // Internal packages.
            ['^(@|components)(/.*|$)'],
            // Side effect imports.
            ['^\\u0000'],
            // Parent imports. Put `..` last.
            ['^\\.\\.(?!/?$)', '^\\.\\./?$'],
            // Other relative imports. Put same-folder imports and `.` last.
            ['^\\./(?=.*/)(?!/?$)', '^\\.(?!/?$)', '^\\./?$'],
            // Style imports.
            ['^.+\\.?(css)$']
          ]
        }
      ],
      'simple-import-sort/exports': 'error',
      // Guards against stupidity
      'no-self-compare': 'error',
      'no-unreachable-loop': 'error',
      'no-template-curly-in-string': 'error', // Catches "${}" template strings
      'default-case': ['error', { commentPattern: '^skip\\sdefault' }], // require default switch case
      'default-case-last': 'error' // enforce default switch case last
    }
  }
];
