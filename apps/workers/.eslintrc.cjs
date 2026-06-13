/* eslint-disable */
// S-P0-03/T01 (W-76 / KI#5 T02): workers had NO lint — now covered by hard CI.
// Mirrors apps/gateway/.eslintrc.cjs. tsconfig.json already includes specs, so
// typed linting needs no separate lint project here.
module.exports = {
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: 'tsconfig.json',
    tsconfigRootDir: __dirname,
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint/eslint-plugin'],
  extends: ['plugin:@typescript-eslint/recommended', 'prettier'],
  root: true,
  env: {
    node: true,
  },
  ignorePatterns: ['.eslintrc.cjs', 'dist'],
  rules: {
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    // No raw console.log — workers use createLogger() (Pino). Bootstrap errors OK.
    'no-console': ['warn', { allow: ['error'] }],
  },
  overrides: [
    {
      files: ['**/*.spec.ts', '**/*.test.ts'],
      rules: {
        '@typescript-eslint/no-explicit-any': 'off',
      },
    },
    {
      // CLI entrypoints (skeleton stub + dev seed runner) — console IS the output
      // channel, same as scripts/*.ts seeders. Service logic uses createLogger().
      files: ['src/index.ts', 'src/shopee-mock-seed-worker.ts'],
      rules: {
        'no-console': 'off',
      },
    },
  ],
};
