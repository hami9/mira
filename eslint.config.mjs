// تنظیمات مشترک ESLint برای همه‌ی apps و packages مونوریپو (فرمت flat config در ESLint 9)
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettierConfig from 'eslint-config-prettier';

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/build/**',
      '**/node_modules/**',
      '**/*.min.js',
      // باندل build‌شده‌ی ویجت که برای صفحه‌ی دمو کپی می‌شود — سورس نیست
      'apps/api/public/widget-dist/**',
      'playwright-report/**',
      'test-results/**',
      'apps/api/dashboard/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  prettierConfig,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
  {
    // اسکریپت‌های Node (مثل esbuild.config.mjs) — globals محیط Node را بشناس
    files: ['**/*.mjs', '**/*.cjs'],
    languageOptions: {
      globals: {
        process: 'readonly',
        console: 'readonly',
        require: 'readonly',
        __dirname: 'readonly',
        setTimeout: 'readonly',
        URL: 'readonly',
        fetch: 'readonly',
        crypto: 'readonly',
      },
    },
  },
  {
    files: ['package/hosting/app.cjs'],
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },
  {
    // اسکریپت‌های استاتیک مرورگر (مثل config.js زمان اجرای داشبورد)
    files: ['**/public/**/*.js', 'package/hosting/configure.js'],
    languageOptions: {
      globals: {
        window: 'readonly',
        document: 'readonly',
        Uint8Array: 'readonly',
      },
    },
  },
);
