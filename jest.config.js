const nextJest = require('next/jest')

const createJestConfig = nextJest({
  dir: './',
})

const customJestConfig = {
  // roots 是路徑不是 glob：Windows 上 <rootDir> 含 `\.claude` 時，放進 glob 會被當成跳脫字元而比對不到任何測試
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.[jt]s?(x)'],
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
