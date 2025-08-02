// Jest setup file for gatsby-source-guru tests

// Suppress console.log during tests unless verbose is enabled
if (!process.env.VERBOSE_TESTS) {
  const originalConsoleLog = console.log
  console.log = (...args) => {
    // Only show logs that contain 'error', 'warn', or 'fail'
    const message = args.join(' ')
    if (message.includes('error') || message.includes('warn') || message.includes('fail')) {
      originalConsoleLog(...args)
    }
  }
}

// Mock crypto for consistent hashing in tests
const crypto = require('crypto')
const originalCreateHash = crypto.createHash

crypto.createHash = (algorithm) => {
  const hash = originalCreateHash(algorithm)
  const originalUpdate = hash.update
  const originalDigest = hash.digest
  
  hash.update = function(data) {
    // For tests, create deterministic hashes based on content
    if (typeof data === 'string' && data.includes('test')) {
      return originalUpdate.call(this, 'test-content-hash')
    }
    return originalUpdate.call(this, data)
  }
  
  return hash
}

// Mock Buffer for consistent base64 encoding in tests
global.mockBase64 = (str) => Buffer.from(str).toString('base64')

// Set up test timeouts
jest.setTimeout(10000)

// Global test helpers
global.createMockCard = (overrides = {}) => ({
  id: 'test-card-id',
  preferredPhrase: 'Test Card',
  content: '<p>Test content</p>',
  htmlContent: true,
  owner: {
    id: 'test-user',
    firstName: 'Test',
    lastName: 'User',
    email: 'test@example.com'
  },
  collection: {
    id: 'test-collection',
    name: 'Test Collection'
  },
  lastModified: '2025-01-01T00:00:00.000Z',
  dateCreated: '2025-01-01T00:00:00.000Z',
  verifiers: [],
  boards: [],
  shareStatus: 'PUBLIC',
  commentsEnabled: true,
  cardType: 'CARD',
  ...overrides
})

global.createMockGatsbyArgs = () => ({
  actions: {
    createNode: jest.fn(),
    createTypes: jest.fn()
  },
  reporter: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    panic: jest.fn()
  },
  createNodeId: jest.fn((id) => `gatsby-${id}`),
  createContentDigest: jest.fn((obj) => `digest-${JSON.stringify(obj).slice(0, 8)}`)
})