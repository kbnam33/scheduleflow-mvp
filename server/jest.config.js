module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.js'],
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov'],
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '/coverage/',
    '/logs/'
  ],
  setupFiles: ['<rootDir>/src/__tests__/setup.js'],
  verbose: true,
  testTimeout: 10000,
  transform: {
    '^.+\\.js$': 'babel-jest'
  }
}; 