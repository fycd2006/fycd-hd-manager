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
  // 預設 worker 數是核心數 − 1，每個 jsdom worker 約 250 MB，記憶體吃滿時會分頁，元件測試隨機超過 5 秒逾時
  maxWorkers: '50%',
}

module.exports = createJestConfig(customJestConfig)
