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

describe('api', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    createAuthHeaders.mockReturnValue({
      'Authorization': 'Basic dGVzdDp0ZXN0',
      'Accept': 'application/json'
    })
  })

  describe('fetchCardsFromSearch', () => {
    it('should fetch cards successfully from search API', async () => {
      const mockCards = [
        { id: 'card-1', title: 'Card 1' },
        { id: 'card-2', title: 'Card 2' }
      ]

      fetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockCards)
      })

      const pluginOptions = {
        authMode: 'collection',
        collectionId: 'test-collection',
        collectionToken: 'test-token'
      }

      const result = await fetchCardsFromSearch(pluginOptions)

      expect(fetch).toHaveBeenCalledWith(
        `${GURU_SEARCH_BASE}?q=`,
        { headers: { 'Authorization': 'Basic dGVzdDp0ZXN0', 'Accept': 'application/json' } }
      )
      expect(result).toEqual(mockCards)
    })

    it('should handle API errors', async () => {
      fetch.mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        text: jest.fn().mockResolvedValue('Invalid credentials')
      })

      const pluginOptions = {
        authMode: 'collection',
        collectionId: 'test-collection',
        collectionToken: 'test-token'
      }

      await expect(fetchCardsFromSearch(pluginOptions)).rejects.toThrow(
        'Failed to fetch cards via search: 401 Unauthorized - Invalid credentials'
      )
    })

    it('should log sample card structure when cards are found', async () => {
      const mockCards = [
        { id: 'card-1', title: 'Card 1', content: '<p>Content</p>' }
      ]

      fetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockCards)
      })

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation()

      await fetchCardsFromSearch({})

      expect(consoleSpy).toHaveBeenCalledWith(
        'Sample card structure:',
        expect.any(String)
      )

      consoleSpy.mockRestore()
    })

    it('should handle empty search results', async () => {
      fetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue([])
      })

      const result = await fetchCardsFromSearch({})

      expect(result).toEqual([])
    })
  })

  describe('fetchCardsFromTeam', () => {
    it('should fetch cards successfully from team API', async () => {
      const mockCards = [
        { id: 'card-1', title: 'Card 1' },
        { id: 'card-2', title: 'Card 2' }
      ]

      fetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockCards)
      })

      const result = await fetchCardsFromTeam('test-team', {})

      expect(fetch).toHaveBeenCalledWith(
        `${GURU_API_BASE}/teams/test-team/cards`,
        { headers: { 'Authorization': 'Basic dGVzdDp0ZXN0', 'Accept': 'application/json' } }
      )
      expect(result).toEqual(mockCards)
    })

    it('should handle API errors', async () => {
      fetch.mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found'
      })

      await expect(fetchCardsFromTeam('nonexistent-team', {})).rejects.toThrow(
        'Failed to fetch cards: 404 Not Found'
      )
    })
  })

  describe('fetchBoardParents', () => {
    it('should fetch parent information for boards', async () => {
      const boards = new Map([
        ['board-1', { id: 'board-1', title: 'Board 1' }],
        ['board-2', { id: 'board-2', title: 'Board 2' }]
      ])

      const headers = { 'Authorization': 'Basic test' }

      // Mock responses for parent API calls
      fetch
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue({ id: 'parent-1', title: 'Parent 1' })
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 404
        })

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation()

      const result = await fetchBoardParents(boards, headers)

      expect(fetch).toHaveBeenCalledTimes(2)
      expect(fetch).toHaveBeenCalledWith(
        `${GURU_API_BASE}/folders/board-1/parent`,
        { headers }
      )
      expect(fetch).toHaveBeenCalledWith(
        `${GURU_API_BASE}/folders/board-2/parent`,
        { headers }
      )

      const resultArray = Array.from(result.values())
      expect(resultArray[0]).toMatchObject({
        id: 'board-1',
        title: 'Board 1',
        parentFolder: { id: 'parent-1', title: 'Parent 1' }
      })
      expect(resultArray[1]).toMatchObject({
        id: 'board-2',
        title: 'Board 2',
        parentFolder: null
      })

      consoleSpy.mockRestore()
    })

    it('should handle API errors gracefully', async () => {
      const boards = new Map([
        ['board-1', { id: 'board-1', title: 'Board 1' }]
      ])

      fetch.mockRejectedValue(new Error('Network error'))

      const warnSpy = jest.spyOn(console, 'warn').mockImplementation()

      const result = await fetchBoardParents(boards, {})

      expect(warnSpy).toHaveBeenCalledWith(
        'Could not fetch parent for board board-1:',
        'Network error'
      )

      const resultArray = Array.from(result.values())
      expect(resultArray[0]).toMatchObject({
        id: 'board-1',
        title: 'Board 1',
        parentFolder: null
      })

      warnSpy.mockRestore()
    })
  })

  describe('fetchCollections', () => {
    it('should fetch collections successfully', async () => {
      const mockCollections = [
        { id: 'collection-1', name: 'Collection 1' },
        { id: 'collection-2', name: 'Collection 2' }
      ]

      fetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockCollections)
      })

      const result = await fetchCollections('test-team', {})

      expect(fetch).toHaveBeenCalledWith(
        `${GURU_API_BASE}/teams/test-team/collections`,
        { headers: {} }
      )
      expect(result).toEqual(mockCollections)
    })

    it('should handle API errors', async () => {
      fetch.mockResolvedValue({
        ok: false,
        status: 403,
        statusText: 'Forbidden'
      })

      await expect(fetchCollections('test-team', {})).rejects.toThrow(
        'Failed to fetch collections: 403 Forbidden'
      )
    })
  })

  describe('fetchBoards', () => {
    it('should fetch boards successfully', async () => {
      const mockBoards = [
        { id: 'board-1', title: 'Board 1' },
        { id: 'board-2', title: 'Board 2' }
      ]

      fetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockBoards)
      })

      const result = await fetchBoards('test-team', {})

      expect(fetch).toHaveBeenCalledWith(
        `${GURU_API_BASE}/teams/test-team/boards`,
        { headers: {} }
      )
      expect(result).toEqual(mockBoards)
    })

    it('should handle API errors', async () => {
      fetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error'
      })

      await expect(fetchBoards('test-team', {})).rejects.toThrow(
        'Failed to fetch boards: 500 Internal Server Error'
      )
    })
  })

  describe('downloadFile', () => {
    it('should download file successfully', async () => {
      const mockBuffer = Buffer.from('file content')

      fetch.mockResolvedValue({
        ok: true,
        buffer: () => Promise.resolve(mockBuffer),
        headers: {
          get: jest.fn().mockReturnValue('application/pdf')
        }
      })

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation()

      const result = await downloadFile('https://example.com/file.pdf', {})

      expect(fetch).toHaveBeenCalledWith(
        'https://example.com/file.pdf',
        { headers: {} }
      )
      expect(result).toEqual({
        buffer: mockBuffer,
        contentType: 'application/pdf'
      })

      consoleSpy.mockRestore()
    })

    it('should handle special headers for Guru content API', async () => {
      const mockBuffer = Buffer.from('image content')

      fetch.mockResolvedValue({
        ok: true,
        buffer: () => Promise.resolve(mockBuffer),
        headers: {
          get: jest.fn().mockReturnValue('image/jpeg')
        }
      })

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation()

      const headers = { 'Accept': 'application/json', 'Accept-Language': 'en-US' }
      await downloadFile('https://content.api.getguru.com/files/view/123', headers)

      expect(fetch).toHaveBeenCalledWith(
        'https://content.api.getguru.com/files/view/123',
        {
          headers: {
            'Accept': '*/*',
            // 'Accept-Language' should be deleted
          }
        }
      )

      consoleSpy.mockRestore()
    })

    it('should handle download failures', async () => {
      fetch.mockResolvedValue({
        ok: false,
        status: 404,
        headers: {
          get: jest.fn().mockReturnValue(null)
        }
      })

      const warnSpy = jest.spyOn(console, 'warn').mockImplementation()
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation()

      const result = await downloadFile('https://example.com/nonexistent.pdf', {})

      expect(result).toBeNull()
      expect(warnSpy).toHaveBeenCalledWith(
        'Failed to download file from https://example.com/nonexistent.pdf: 404'
      )

      warnSpy.mockRestore()
      consoleSpy.mockRestore()
    })

    it('should handle network errors', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation()
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation()
      
      fetch.mockRejectedValue(new Error('Network error'))

      const result = await downloadFile('https://example.com/file.pdf', {})

      expect(result).toBeNull()
      
      consoleSpy.mockRestore()
      warnSpy.mockRestore()
    })

    it('should default to application/octet-stream when no content-type header', async () => {
      const mockBuffer = Buffer.from('file content')

      fetch.mockResolvedValue({
        ok: true,
        buffer: () => Promise.resolve(mockBuffer),
        headers: {
          get: jest.fn().mockReturnValue(null)
        }
      })

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation()

      const result = await downloadFile('https://example.com/file', {})

      expect(result).toEqual({
        buffer: mockBuffer,
        contentType: 'application/octet-stream'
      })

      consoleSpy.mockRestore()
    })

    it('should preserve original headers for non-Guru URLs', async () => {
      const mockBuffer = Buffer.from('content')

      fetch.mockResolvedValue({
        ok: true,
        buffer: () => Promise.resolve(mockBuffer),
        headers: {
          get: jest.fn().mockReturnValue('text/plain')
        }
      })

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation()

      const originalHeaders = { 
        'Authorization': 'Bearer token',
        'Accept-Language': 'en-US'
      }

      await downloadFile('https://external-site.com/file.txt', originalHeaders)

      expect(fetch).toHaveBeenCalledWith(
        'https://external-site.com/file.txt',
        { headers: originalHeaders }
      )

      consoleSpy.mockRestore()
    })
  })

  describe('Constants', () => {
    it('should have correct API base URLs', () => {
      expect(GURU_API_BASE).toBe('https://api.getguru.com/api/v1')
      expect(GURU_SEARCH_BASE).toBe('https://api.getguru.com/api/v1/search/query')
    })
  })
})