import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';
import prettierPlugin from 'eslint-plugin-prettier';

const moduleFileName = fileURLToPath(import.meta.url);
const moduleDirectoryName = dirname(moduleFileName);

const baseRules = {
  ...prettier.rules,
  'prettier/prettier': 'error',
  'no-console': 'off',
  'no-debugger': 'error',
  'no-alert': 'off',
  'no-eval': 'error',
  'no-implied-eval': 'error',
  'no-new-func': 'error',
  'no-script-url': 'error',
  eqeqeq: ['error', 'always'],
  'no-eq-null': 'off',
  curly: ['error', 'all'],
  'no-throw-literal': 'error',
  'prefer-const': 'error',
  'no-var': 'error',
  'prefer-arrow-callback': 'error',
  'prefer-template': 'error',
  'prefer-spread': 'error',
  'prefer-rest-params': 'error',
  'prefer-destructuring': ['error', { object: true, array: false }],
  'no-useless-return': 'error',
  'no-useless-concat': 'error',
  'no-useless-rename': 'error',
  'no-useless-computed-key': 'error',
  'object-shorthand': 'error',
  'no-param-reassign': ['error', { props: true }],
  'no-return-assign': 'error',
  'no-return-await': 'off',
  'no-self-compare': 'error',
  'no-sequences': 'error',
  'no-unmodified-loop-condition': 'error',
  'no-unused-expressions': 'error',
  'no-useless-call': 'error',
  'no-void': 'error',
  'no-warning-comments': 'warn',
  'prefer-promise-reject-errors': 'error',
  radix: 'error',
  'require-await': 'error',
  yoda: 'error',
  'no-shadow': 'off',
  '@typescript-eslint/no-shadow': 'error',
  'no-undef': 'off',
  'no-unused-vars': 'off',
  'no-use-before-define': 'off',
  '@typescript-eslint/no-use-before-define': 'error',
  'no-redeclare': 'off',
  '@typescript-eslint/no-redeclare': 'error',
  '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
  '@typescript-eslint/no-explicit-any': 'error',
  '@typescript-eslint/prefer-as-const': 'error',
  '@typescript-eslint/prefer-readonly-parameter-types': 'off',
  '@typescript-eslint/prefer-promise-reject-errors': 'error',
  '@typescript-eslint/no-misused-new': 'error',
  '@typescript-eslint/no-non-null-assertion': 'warn',
  '@typescript-eslint/consistent-type-assertions': [
    'error',
    { assertionStyle: 'as', objectLiteralTypeAssertions: 'never' },
  ],
  '@typescript-eslint/consistent-type-definitions': ['error', 'interface'],
  '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
  '@typescript-eslint/no-import-type-side-effects': 'error',
  '@typescript-eslint/array-type': ['error', { default: 'array-simple' }],
  '@typescript-eslint/prefer-for-of': 'error',
  '@typescript-eslint/prefer-function-type': 'error',
  '@typescript-eslint/prefer-namespace-keyword': 'error',
  '@typescript-eslint/prefer-regexp-exec': 'error',
  '@typescript-eslint/prefer-ts-expect-error': 'error',
  '@typescript-eslint/unified-signatures': 'error',
  '@typescript-eslint/no-empty-function': 'error',
  '@typescript-eslint/no-inferrable-types': 'error',
  '@typescript-eslint/no-namespace': 'error',
  '@typescript-eslint/no-this-alias': 'error',
  '@typescript-eslint/no-useless-empty-export': 'error',
  '@typescript-eslint/no-var-requires': 'error',
  '@typescript-eslint/prefer-literal-enum-member': 'error',
  '@typescript-eslint/prefer-enum-initializers': 'error',
};

const typeCheckedRules = {
  '@typescript-eslint/prefer-nullish-coalescing': 'error',
  '@typescript-eslint/prefer-optional-chain': 'error',
  '@typescript-eslint/switch-exhaustiveness-check': 'error',
  '@typescript-eslint/no-unnecessary-condition': 'error',
  '@typescript-eslint/no-unnecessary-boolean-literal-compare': 'error',
  '@typescript-eslint/no-unnecessary-type-arguments': 'error',
  '@typescript-eslint/prefer-readonly': 'error',
  '@typescript-eslint/prefer-return-this-type': 'error',
  '@typescript-eslint/no-redundant-type-constituents': 'error',
  '@typescript-eslint/prefer-includes': 'error',
  '@typescript-eslint/prefer-string-starts-ends-with': 'error',
  '@typescript-eslint/prefer-reduce-type-parameter': 'error',
  '@typescript-eslint/no-confusing-void-expression': 'error',
  '@typescript-eslint/no-meaningless-void-operator': 'error',
};

const typeScriptFiles = [
  'src/**/*.ts',
  'src/**/*.tsx',
  'test/**/*.ts',
  'test/**/*.tsx',
  '*.config.ts',
];

const sharedRules = {
  ...baseRules,
  ...typeCheckedRules,
};

export default [
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      '**/template/**',
      'eslint.config.js',
      'src/**/*.d.ts',
    ],
  },
  {
    files: ['*.config.js'],
    languageOptions: {
      globals: {
        process: 'readonly',
        console: 'readonly',
        Buffer: 'readonly',
        global: 'readonly',
      },
      ecmaVersion: 2022,
      sourceType: 'module',
    },
    rules: {
      'no-console': 'off',
    },
  },
  {
    files: ['*.config.cjs'],
    languageOptions: {
      globals: {
        require: 'readonly',
        module: 'readonly',
        exports: 'readonly',
        process: 'readonly',
        console: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        Buffer: 'readonly',
        global: 'readonly',
      },
      ecmaVersion: 2022,
      sourceType: 'script',
    },
    rules: {
      'no-console': 'off',
      '@typescript-eslint/no-var-requires': 'off',
    },
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended.map((config) => ({
    ...config,
    files: typeScriptFiles,
  })),
  {
    files: typeScriptFiles,
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
      },
    },
    plugins: {
      prettier: prettierPlugin,
    },
    rules: sharedRules,
  },
  ...tseslint.configs.recommendedTypeChecked.map((config) => ({
    ...config,
    files: typeScriptFiles,
    languageOptions: {
      ...config.languageOptions,
      parserOptions: {
        ...config.languageOptions?.parserOptions,
        project: [
          resolve(moduleDirectoryName, 'tsconfig.json'),
          resolve(moduleDirectoryName, 'tsconfig.check.json'),
        ],
      },
    },
  })),
  ...tseslint.configs.stylistic.map((config) => ({
    ...config,
    files: typeScriptFiles,
  })),
  {
    files: typeScriptFiles,
    rules: {
      ...sharedRules,
      '@typescript-eslint/explicit-function-return-type': 'error',
      '@typescript-eslint/explicit-module-boundary-types': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': [
        'error',
        {
          checksVoidReturn: false,
        },
      ],
      '@typescript-eslint/await-thenable': 'error',
      '@typescript-eslint/no-unnecessary-type-assertion': 'error',
      '@typescript-eslint/no-unsafe-assignment': 'error',
      '@typescript-eslint/no-unsafe-call': 'error',
      '@typescript-eslint/no-unsafe-member-access': 'error',
      '@typescript-eslint/no-unsafe-return': 'error',
      '@typescript-eslint/no-unsafe-argument': 'error',
      '@typescript-eslint/restrict-plus-operands': 'error',
      '@typescript-eslint/restrict-template-expressions': 'error',
      '@typescript-eslint/require-array-sort-compare': 'error',
      '@typescript-eslint/return-await': 'error',
    },
  },
];
