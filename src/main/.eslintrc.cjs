/* eslint-env node */
const { base, typescript } = require('../../.eslintrc.base.cjs')

module.exports = {
  root: true,
  ignorePatterns: ['vendors'],
  ...base,
  overrides: [
    {
      ...typescript,
      parserOptions: {
        project: './tsconfig.json',
      },
    },
  ],
}
