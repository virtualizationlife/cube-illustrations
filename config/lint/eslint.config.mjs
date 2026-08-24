import path from 'node:path'

import eslintReact from '@eslint-react/eslint-plugin'
import { createTypeScriptImportResolver } from 'eslint-import-resolver-typescript'
import eslintConfigPrettier from 'eslint-config-prettier'
import importPlugin, { createNodeResolver } from 'eslint-plugin-import-x'
import nPlugin from 'eslint-plugin-n'
import reactHooks from 'eslint-plugin-react-hooks'
import unicorn from 'eslint-plugin-unicorn'
import globals from 'globals'
import tseslint from 'typescript-eslint'

const repoRoot = path.resolve(import.meta.dirname, '../..')

export default tseslint.config(
    {
        ignores: ['dist', 'node_modules', 'config/lint/**', '**/*.mjs', '**/*.cjs'],
    },
    ...tseslint.configs.strictTypeChecked,
    ...tseslint.configs.stylisticTypeChecked,
    {
        files: ['**/*.{ts,tsx}'],
        languageOptions: {
            parser: tseslint.parser,
            parserOptions: {
                projectService: true,
                tsconfigRootDir: repoRoot,
                sourceType: 'module',
                ecmaVersion: 'latest',
                ecmaFeatures: { jsx: true },
            },
            globals: { ...globals.browser, ...globals.node, ...globals.es2021 },
        },
        plugins: {
            '@typescript-eslint': tseslint.plugin,
            ...eslintReact.configs['recommended-typescript'].plugins,
            'react-hooks': reactHooks,
            import: importPlugin,
            unicorn,
            n: nPlugin,
        },
        settings: {
            'import-x/resolver-next': [
                createTypeScriptImportResolver({
                    alwaysTryTypes: true,
                    project: path.resolve(repoRoot, 'tsconfig.json'),
                }),
                createNodeResolver({
                    extensions: ['.js', '.mjs', '.cjs', '.jsx', '.ts', '.tsx', '.d.ts'],
                }),
            ],
        },
        rules: {
            ...eslintReact.configs['recommended-typescript'].rules,
            ...reactHooks.configs.recommended.rules,
            '@typescript-eslint/consistent-type-definitions': ['error', 'type'],
            '@typescript-eslint/no-unused-vars': [
                'error',
                { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
            ],
            '@typescript-eslint/restrict-template-expressions': [
                'error',
                { allowNumber: true, allowBoolean: true },
            ],
            'import/order': [
                'error',
                {
                    groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
                    'newlines-between': 'always',
                    alphabetize: { order: 'asc', caseInsensitive: true },
                },
            ],
            'unicorn/filename-case': [
                'error',
                {
                    cases: { camelCase: true, pascalCase: true },
                    ignore: ['vite.config.ts', 'vite.demo.config.ts', 'vite-env.d.ts'],
                },
            ],
            'unicorn/prevent-abbreviations': 'off',
            'unicorn/no-null': 'off',
            'unicorn/prefer-global-this': 'off',
            'n/no-missing-import': 'off',
            'n/no-unpublished-import': 'off',
            '@eslint-react/no-context-provider': 'off',
            '@eslint-react/no-use-context': 'off',
        },
    },
    eslintConfigPrettier
)
