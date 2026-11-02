import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  { ignores: ['**/dist/**', '**/node_modules/**', 'coverage/**'] },
  js.configs.recommended,
  ...tseslint.configs.strict,
  prettier,
  {
    rules: {
      'max-lines': ['error', { max: 150, skipBlankLines: false, skipComments: false }],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
    },
  },
  {
    // Translation dictionaries are flat data (one entry per UI string) and only ever grow.
    files: ['apps/web/src/shared/i18n/*.ts'],
    ignores: ['apps/web/src/shared/i18n/*.test.ts'],
    rules: { 'max-lines': 'off' },
  },
);
