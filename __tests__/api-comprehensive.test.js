/**
 * @jest-environment node
 */

const {
  fetchCardsFromSearch,
  fetchCardsFromTeam,
  fetchBoardParents,
  fetchCollections,
  fetchBoards,
  downloadFile,
  GURU_API_BASE,
  GURU_SEARCH_BASE
} = require('../api')

// Mock node-fetch
jest.mock('node-fetch')
const fetch = require('node-fetch')

// Mock utils
jest.mock('../utils', () => ({
  createAuthHeaders: jest.fn()
}))

const { createAuthHeaders } = require('../utils')

describe('api - comprehensive tests', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    createAuthHeaders.mockReturnValue({
      'Authorization': 'Basic dGVzdDp0ZXN0',
      'Accept': 'application/json'
    })
  })

  describe('fetchCardsFromSearch - edge cases', () => {
    it('should handle null response from API', async () => {
      fetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(null)
      })

      const result = await fetchCardsFromSearch({})
      expect(result).toBeNull()
    })

    it('should handle malformed JSON response', async () => {
      fetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockRejectedValue(new Error('Invalid JSON'))
      })

      await expect(fetchCardsFromSearch({})).rejects.toThrow('Invalid JSON')
    })

    it('should log correct search URL format', async () => {
      fetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue([])
      })

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation()

      await fetchCardsFromSearch({})

      expect(consoleSpy).toHaveBeenCalledWith('Using search API for collection auth mode')
      expect(consoleSpy).toHaveBeenCalledWith('Search URL:', `${GURU_SEARCH_BASE}?q=`)

      consoleSpy.mockRestore()
    })

    it('should handle authentication errors with detailed logging', async () => {
      const errorResponse = {
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        headers: { get: jest.fn().mockReturnValue('application/json') },
        text: jest.fn().mockResolvedValue('{"error": "Invalid credentials"}')
      }

      fetch.mockResolvedValue(errorResponse)

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation()

      await expect(fetchCardsFromSearch({})).rejects.toThrow(
        'Failed to fetch cards via search: 403 Forbidden - {"error": "Invalid credentials"}'
      )

      expect(consoleErrorSpy).toHaveBeenCalledWith('Response status:', 403)
      expect(consoleErrorSpy).toHaveBeenCalledWith('Response headers:', errorResponse.headers)
      expect(consoleErrorSpy).toHaveBeenCalledWith('Error body:', '{"error": "Invalid credentials"}')

      consoleErrorSpy.mockRestore()
    })

    it('should not log sample card when results are empty', async () => {
      fetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue([])
      })

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation()

      await fetchCardsFromSearch({})

      expect(consoleSpy).toHaveBeenCalledWith('Found 0 cards via search')
      expect(consoleSpy).not.toHaveBeenCalledWith(
        'Sample card structure:',
        expect.any(String)
      )

      consoleSpy.mockRestore()
    })
  })

  describe('fetchCardsFromTeam - edge cases', () => {
    it('should handle timeout errors', async () => {
      fetch.mockRejectedValue(new Error('Request timeout'))

      await expect(fetchCardsFromTeam('testteam', {})).rejects.toThrow('Request timeout')
    })

    it('should handle non-JSON responses', async () => {
      fetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockRejectedValue(new Error('Unexpected token'))
      })

      await expect(fetchCardsFromTeam('testteam', {})).rejects.toThrow('Unexpected token')
    })

    it('should handle server errors with status codes', async () => {
      const errorCodes = [500, 502, 503, 504]
      
      for (const code of errorCodes) {
        fetch.mockResolvedValueOnce({
          ok: false,
          status: code,
          statusText: `Server Error ${code}`
        })

        await expect(fetchCardsFromTeam('testteam', {})).rejects.toThrow(
          `Failed to fetch cards: ${code} Server Error ${code}`
        )
      }
    })
  })

  describe('fetchBoardParents - comprehensive coverage', () => {
    it('should handle mixed success and failure responses', async () => {
      const boards = new Map([
        ['board-1', { id: 'board-1', title: 'Board 1' }],
        ['board-2', { id: 'board-2', title: 'Board 2' }],
        ['board-3', { id: 'board-3', title: 'Board 3' }]
      ])

      // Mock different responses for each board
      fetch
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue({ id: 'parent-1', title: 'Parent 1' })
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 404
        })
        .mockRejectedValueOnce(new Error('Network error'))

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation()
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation()

      const result = await fetchBoardParents(boards, {})

      expect(result.size).toBe(3)
      
      // Check first board has parent
      expect(result.get('board-1')).toMatchObject({
        id: 'board-1',
        title: 'Board 1',
        parentFolder: { id: 'parent-1', title: 'Parent 1' }
      })

      // Check second board has no parent (404)
      expect(result.get('board-2')).toMatchObject({
        id: 'board-2',
        title: 'Board 2',
        parentFolder: null
      })

      // Check third board has null parent (network error)
      expect(result.get('board-3')).toMatchObject({
        id: 'board-3',
        title: 'Board 3',
        parentFolder: null
      })

      expect(warnSpy).toHaveBeenCalledWith(
        'Could not fetch parent for board board-3:',
        'Network error'
      )

      consoleSpy.mockRestore()
      warnSpy.mockRestore()
    })

    it('should handle empty boards map', async () => {
      const boards = new Map()
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation()

      const result = await fetchBoardParents(boards, {})

      expect(result.size).toBe(0)
      expect(consoleSpy).toHaveBeenCalledWith('Fetching parent information for 0 boards...')

      consoleSpy.mockRestore()
    })

    it('should construct correct API URLs', async () => {
      const boards = new Map([
        ['board-123', { id: 'board-123', title: 'Test Board' }]
      ])

      fetch.mockResolvedValue({
        ok: false,
        status: 404
      })

      await fetchBoardParents(boards, { 'Authorization': 'Bearer token' })

      expect(fetch).toHaveBeenCalledWith(
        `${GURU_API_BASE}/folders/board-123/parent`,
        { headers: { 'Authorization': 'Bearer token' } }
      )
    })
  })

  describe('fetchCollections - error handling', () => {
    it('should handle various HTTP error codes', async () => {
      const errorScenarios = [
        { status: 401, statusText: 'Unauthorized', expectedMessage: 'Failed to fetch collections: 401 Unauthorized' },
        { status: 403, statusText: 'Forbidden', expectedMessage: 'Failed to fetch collections: 403 Forbidden' },
        { status: 404, statusText: 'Not Found', expectedMessage: 'Failed to fetch collections: 404 Not Found' },
        { status: 500, statusText: 'Internal Server Error', expectedMessage: 'Failed to fetch collections: 500 Internal Server Error' }
      ]

      for (const scenario of errorScenarios) {
        fetch.mockResolvedValueOnce({
          ok: false,
          status: scenario.status,
          statusText: scenario.statusText
        })

        await expect(fetchCollections('testteam', {})).rejects.toThrow(scenario.expectedMessage)
      }
    })

    it('should handle network failures', async () => {
      fetch.mockRejectedValue(new Error('ECONNREFUSED'))

      await expect(fetchCollections('testteam', {})).rejects.toThrow('ECONNREFUSED')
    })
  })

  describe('fetchBoards - error handling', () => {
    it('should handle parsing errors', async () => {
      fetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockRejectedValue(new Error('Unexpected end of JSON input'))
      })

      await expect(fetchBoards('testteam', {})).rejects.toThrow('Unexpected end of JSON input')
    })
  })

  describe('downloadFile - comprehensive coverage', () => {
    it('should handle various content types correctly', async () => {
      const testCases = [
        { contentType: 'image/png', expected: 'image/png' },
        { contentType: 'application/json', expected: 'application/json' },
        { contentType: 'text/html; charset=utf-8', expected: 'text/html; charset=utf-8' },
        { contentType: null, expected: 'application/octet-stream' },
        { contentType: '', expected: 'application/octet-stream' }
      ]

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation()

      for (const testCase of testCases) {
        const mockBuffer = Buffer.from('test content')
        
        fetch.mockResolvedValueOnce({
          ok: true,
          buffer: () => Promise.resolve(mockBuffer),
          headers: {
            get: jest.fn().mockReturnValue(testCase.contentType)
          }
        })

        const result = await downloadFile('https://example.com/file', {})

        expect(result).toEqual({
          buffer: mockBuffer,
          contentType: testCase.expected
        })
      }

      consoleSpy.mockRestore()
    })

    it('should handle different types of request failures', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation()
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation()

      // Test 404 error
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        headers: { get: jest.fn().mockReturnValue(null) }
      })

      let result = await downloadFile('https://example.com/notfound', {})
      expect(result).toBeNull()

      // Test 500 error
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        headers: { get: jest.fn().mockReturnValue(null) }
      })

      result = await downloadFile('https://example.com/servererror', {})
      expect(result).toBeNull()

      expect(warnSpy).toHaveBeenCalledTimes(2)

      consoleSpy.mockRestore()
      warnSpy.mockRestore()
    })

    it('should handle buffer conversion errors', async () => {
      fetch.mockResolvedValue({
        ok: true,
        buffer: () => Promise.reject(new Error('Buffer error')),
        headers: { get: jest.fn().mockReturnValue('text/plain') }
      })

      const result = await downloadFile('https://example.com/file', {})
      expect(result).toBeNull()
    })

    it('should handle Guru content API special cases', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation()
      
      // Test that Guru URLs get special header handling
      const originalHeaders = {
        'Authorization': 'Bearer token',
        'Accept-Language': 'en-US',
        'User-Agent': 'test-agent'
      }

      fetch.mockResolvedValue({
        ok: true,
        buffer: () => Promise.resolve(Buffer.from('content')),
        headers: { get: jest.fn().mockReturnValue('image/jpeg') }
      })

      await downloadFile('https://content.api.getguru.com/files/view/test', originalHeaders)

      expect(fetch).toHaveBeenCalledWith(
        'https://content.api.getguru.com/files/view/test',
        {
          headers: {
            'Authorization': 'Bearer token',
            'User-Agent': 'test-agent',
            'Accept': '*/*'
            // Note: 'Accept-Language' should be deleted for Guru URLs
          }
        }
      )

      consoleSpy.mockRestore()
    })

    it('should preserve original headers for non-Guru URLs', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation()
      
      const originalHeaders = {
        'Authorization': 'Bearer token',
        'Accept-Language': 'en-US',
        'User-Agent': 'test-agent'
      }

      fetch.mockResolvedValue({
        ok: true,
        buffer: () => Promise.resolve(Buffer.from('content')),
        headers: { get: jest.fn().mockReturnValue('text/plain') }
      })

      await downloadFile('https://external-site.com/file.txt', originalHeaders)

      expect(fetch).toHaveBeenCalledWith(
        'https://external-site.com/file.txt',
        { headers: originalHeaders }
      )

      consoleSpy.mockRestore()
    })

    it('should handle empty headers object', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation()

      fetch.mockResolvedValue({
        ok: true,
        buffer: () => Promise.resolve(Buffer.from('content')),
        headers: { get: jest.fn().mockReturnValue('text/plain') }
      })

      const result = await downloadFile('https://example.com/file', {})

      expect(result).toEqual({
        buffer: Buffer.from('content'),
        contentType: 'text/plain'
      })

      consoleSpy.mockRestore()
    })
  })

  describe('API constants', () => {
    it('should have correct base URLs', () => {
      expect(GURU_API_BASE).toBe('https://api.getguru.com/api/v1')
      expect(GURU_SEARCH_BASE).toBe('https://api.getguru.com/api/v1/search/query')
    })

    it('should use HTTPS for security', () => {
      expect(GURU_API_BASE).toMatch(/^https:\/\//)
      expect(GURU_SEARCH_BASE).toMatch(/^https:\/\//)
    })

    it('should point to production endpoints', () => {
      expect(GURU_API_BASE).toContain('api.getguru.com')
      expect(GURU_SEARCH_BASE).toContain('api.getguru.com')
    })
  })
})