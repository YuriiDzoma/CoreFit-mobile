const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const eslintConfigPrettier = require('eslint-config-prettier');

module.exports = defineConfig([
  expoConfig,
  {
    // Deno runtime code (Edge Functions) -- `npm:`-specifier imports and
    // `Deno` globals aren't resolvable by this project's Node-oriented
    // ESLint config, and were never meant to be (same reasoning as
    // tsconfig.json's own exclude for this directory).
    ignores: ['dist/*', 'supabase/functions/**'],
  },
  eslintConfigPrettier,
]);
