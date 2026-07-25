import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),

  // Base rules for all JavaScript
  {
    files: ['**/*.{js,jsx}'],
    extends: [js.configs.recommended],
    languageOptions: {
      ecmaVersion: 'latest',
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    rules: {
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]', argsIgnorePattern: '^_' }],
    },
  },

  // React app source (hooks + fast-refresh rules only apply here)
  {
    files: ['src/**/*.{js,jsx}'],
    extends: [
      reactHooks.configs['recommended-latest'],
      reactRefresh.configs.vite,
    ],
    rules: {
      // Exporting a hook/constant alongside a provider is fine; keep as a hint.
      'react-refresh/only-export-components': 'warn',
    },
  },

  // Node-context build/config files
  {
    files: ['*.config.js', 'vite.config.test.js'],
    languageOptions: { globals: globals.node },
  },

  // Electron shell (CommonJS + Node globals)
  {
    files: ['electron/**/*.js'],
    languageOptions: { sourceType: 'commonjs', globals: globals.node },
  },

  // Test files (Vitest + jsdom)
  {
    files: ['src/test/**/*.{js,jsx}', '**/*.test.{js,jsx}'],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  },
])
