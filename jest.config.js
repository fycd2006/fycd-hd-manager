const nextJest = require('next/jest')

const createJestConfig = nextJest({
  dir: './',
})

const customJestConfig = {
  testMatch: ['<rootDir>/src/**/__tests__/**/*.[jt]s?(x)'],
  testPathIgnorePatterns: [
    '<rootDir>/node_modules/',
    '<rootDir>/.baserow_src/',
    '<rootDir>/tmp_baserow_ref/'
  ],
  modulePathIgnorePatterns: [
    '<rootDir>/.baserow_src/',
    '<rootDir>/tmp_baserow_ref/'
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  testEnvironment: 'node',
}

module.exports = createJestConfig(customJestConfig)
