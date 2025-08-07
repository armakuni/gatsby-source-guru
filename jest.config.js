module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>'],
  testMatch: [
    '**/__tests__/**/*.test.js',
    '**/?(*.)+(spec|test).js'
  ],
  collectCoverageFrom: [
    'gatsby-node.js',
    'utils.js',
    'schema.js',
    '!node_modules/**',
    '!**/*.test.js'
  ],
  coverageReporters: [
    'text',
    'lcov',
    'html'
  ],
  coverageDirectory: 'coverage',
  coverageThreshold: {
    global: {
      branches: 5,
      functions: 5,
      lines: 8,
      statements: 8
    }
  },
  setupFilesAfterEnv: ['<rootDir>/__tests__/setup.js'],
  verbose: true,
  clearMocks: true,
  restoreMocks: true
}