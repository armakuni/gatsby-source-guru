/**
 * @jest-environment node
 */

const { sourceNodes, createSchemaCustomization } = require('../gatsby-node')

// Mock all dependencies
jest.mock('../utils', () => ({
  validateOptions: jest.fn(),
  createAuthHeaders: jest.fn()
}))

jest.mock('../api', () => ({
  fetchCardsFromSearch: jest.fn(),
  fetchCardsFromTeam: jest.fn(),
  fetchCollections: jest.fn(),
  fetchBoards: jest.fn(),
  fetchBoardParents: jest.fn()
}))

jest.mock('../card-processor', () => ({
  processCardsCollectionMode: jest.fn(),
  processCardsUserMode: jest.fn(),
  createCollectionNode: jest.fn(),
  createBoardNode: jest.fn()
}))

jest.mock('../schema', () => ({
  typeDefs: `
    type GuruCard implements Node {
      id: ID!
      title: String!
      content: String
    }
  `
}))

const { validateOptions, createAuthHeaders } = require('../utils')
const {
  fetchCardsFromSearch,
  fetchCardsFromTeam,
  fetchCollections,
  fetchBoards,
  fetchBoardParents
} = require('../api')
const {
  processCardsCollectionMode,
  processCardsUserMode,
  createCollectionNode,
  createBoardNode
} = require('../card-processor')

describe('gatsby-node', () => {
  const mockGatsbyFunctions = {
    actions: {
      createNode: jest.fn()
    },
    createNodeId: jest.fn((input) => `node-${input}`),
    createContentDigest: jest.fn((input) => `digest-${JSON.stringify(input).length}`)
  }

  beforeEach(() => {
    jest.clearAllMocks()
    validateOptions.mockImplementation(() => {})
    createAuthHeaders.mockReturnValue({
      'Authorization': 'Basic dGVzdDp0ZXN0',
      'Accept': 'application/json'
    })
  })

  describe('createSchemaCustomization', () => {
    it('should create schema with typeDefs', () => {
      const mockActions = {
        createTypes: jest.fn()
      }

      createSchemaCustomization({ actions: mockActions })

      expect(mockActions.createTypes).toHaveBeenCalledWith(expect.stringContaining('type GuruCard'))
    })
  })

  describe('sourceNodes', () => {
    describe('collection mode', () => {
      it('should process cards in collection mode', async () => {
        const pluginOptions = {
          authMode: 'collection',
          collectionId: 'test-collection',
          collectionToken: 'test-token',
          downloadAttachments: false,
          attachmentDir: 'static/guru-attachments'
        }

        fetchCardsFromSearch.mockResolvedValue([
          { id: 'card-1', title: 'Card 1' },
          { id: 'card-2', title: 'Card 2' }
        ])

        processCardsCollectionMode.mockResolvedValue({
          cardsProcessed: 2,
          boardsFound: 1
        })

        const consoleSpy = jest.spyOn(console, 'log').mockImplementation()

        await sourceNodes(mockGatsbyFunctions, pluginOptions)

        expect(validateOptions).toHaveBeenCalledWith(pluginOptions)
        expect(createAuthHeaders).toHaveBeenCalledWith(pluginOptions)
        expect(fetchCardsFromSearch).toHaveBeenCalledWith(pluginOptions)
        expect(processCardsCollectionMode).toHaveBeenCalledWith(
          [{ id: 'card-1', title: 'Card 1' }, { id: 'card-2', title: 'Card 2' }],
          pluginOptions,
          { 'Authorization': 'Basic dGVzdDp0ZXN0', 'Accept': 'application/json' },
          false,
          'static/guru-attachments',
          mockGatsbyFunctions.createNodeId,
          mockGatsbyFunctions.createContentDigest,
          mockGatsbyFunctions.actions.createNode
        )

        expect(consoleSpy).toHaveBeenCalledWith(
          'Collection mode: Processed 2 cards, found 1 boards'
        )

        consoleSpy.mockRestore()
      })

      it('should handle errors in collection mode', async () => {
        const pluginOptions = {
          authMode: 'collection',
          collectionId: 'test-collection',
          collectionToken: 'test-token'
        }

        fetchCardsFromSearch.mockRejectedValue(new Error('API Error'))

        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation()

        await expect(sourceNodes(mockGatsbyFunctions, pluginOptions)).rejects.toThrow('API Error')

        expect(consoleErrorSpy).toHaveBeenCalledWith(
          'Error fetching Guru data:',
          expect.any(Error)
        )

        consoleErrorSpy.mockRestore()
      })
    })

    describe('user mode', () => {
      it('should process cards in user mode', async () => {
        const pluginOptions = {
          authMode: 'user',
          apiUsername: 'testuser',
          apiPassword: 'testpass',
          teamName: 'testteam',
          downloadAttachments: true,
          attachmentDir: 'static/attachments'
        }

        const mockCards = [
          { id: 'card-1', title: 'Card 1' },
          { id: 'card-2', title: 'Card 2' }
        ]

        fetchCardsFromTeam.mockResolvedValue(mockCards)
        processCardsUserMode.mockResolvedValue({ cardsProcessed: 2 })

        const consoleSpy = jest.spyOn(console, 'log').mockImplementation()

        await sourceNodes(mockGatsbyFunctions, pluginOptions)

        expect(fetchCardsFromTeam).toHaveBeenCalledWith('testteam', pluginOptions)
        expect(processCardsUserMode).toHaveBeenCalledWith(
          mockCards,
          pluginOptions,
          true,
          'static/attachments',
          { 'Authorization': 'Basic dGVzdDp0ZXN0', 'Accept': 'application/json' },
          mockGatsbyFunctions.createNodeId,
          mockGatsbyFunctions.createContentDigest,
          mockGatsbyFunctions.actions.createNode
        )

        expect(consoleSpy).toHaveBeenCalledWith('User mode: Processed 2 cards')

        consoleSpy.mockRestore()
      })

      it('should fetch collections when fetchCollections is enabled', async () => {
        const pluginOptions = {
          authMode: 'user',
          apiUsername: 'testuser',
          apiPassword: 'testpass',
          teamName: 'testteam',
          fetchCollections: true
        }

        const mockCards = []
        const mockCollections = [
          { id: 'collection-1', name: 'Collection 1' },
          { id: 'collection-2', name: 'Collection 2' }
        ]

        fetchCardsFromTeam.mockResolvedValue(mockCards)
        processCardsUserMode.mockResolvedValue({ cardsProcessed: 0 })
        fetchCollections.mockResolvedValue(mockCollections)

        const consoleSpy = jest.spyOn(console, 'log').mockImplementation()

        await sourceNodes(mockGatsbyFunctions, pluginOptions)

        expect(fetchCollections).toHaveBeenCalledWith(
          'testteam',
          { 'Authorization': 'Basic dGVzdDp0ZXN0', 'Accept': 'application/json' }
        )
        expect(createCollectionNode).toHaveBeenCalledTimes(2)
        expect(consoleSpy).toHaveBeenCalledWith('Created 2 collection nodes')

        consoleSpy.mockRestore()
      })

      it('should fetch boards when fetchBoards is enabled', async () => {
        const pluginOptions = {
          authMode: 'user',
          apiUsername: 'testuser',
          apiPassword: 'testpass',
          teamName: 'testteam',
          fetchBoards: true
        }

        const mockCards = []
        const mockBoards = [
          { id: 'board-1', title: 'Board 1' },
          { id: 'board-2', title: 'Board 2' }
        ]
        const mockBoardsWithParents = new Map([
          ['board-1', { id: 'board-1', title: 'Board 1', parentFolder: null }],
          ['board-2', { id: 'board-2', title: 'Board 2', parentFolder: null }]
        ])

        fetchCardsFromTeam.mockResolvedValue(mockCards)
        processCardsUserMode.mockResolvedValue({ cardsProcessed: 0 })
        fetchBoards.mockResolvedValue(mockBoards)
        fetchBoardParents.mockResolvedValue(mockBoardsWithParents)

        const consoleSpy = jest.spyOn(console, 'log').mockImplementation()

        await sourceNodes(mockGatsbyFunctions, pluginOptions)

        expect(fetchBoards).toHaveBeenCalledWith(
          'testteam',
          { 'Authorization': 'Basic dGVzdDp0ZXN0', 'Accept': 'application/json' }
        )
        expect(fetchBoardParents).toHaveBeenCalled()
        expect(createBoardNode).toHaveBeenCalledTimes(2)
        expect(consoleSpy).toHaveBeenCalledWith('Created 2 board nodes')

        consoleSpy.mockRestore()
      })

      it('should handle errors in user mode', async () => {
        const pluginOptions = {
          authMode: 'user',
          apiUsername: 'testuser',
          apiPassword: 'testpass',
          teamName: 'testteam'
        }

        fetchCardsFromTeam.mockRejectedValue(new Error('Team not found'))

        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation()

        await expect(sourceNodes(mockGatsbyFunctions, pluginOptions)).rejects.toThrow('Team not found')

        expect(consoleErrorSpy).toHaveBeenCalledWith(
          'Error fetching Guru data:',
          expect.any(Error)
        )

        consoleErrorSpy.mockRestore()
      })
    })

    describe('default options handling', () => {
      it('should use default options when not provided', async () => {
        const pluginOptions = {
          authMode: 'collection',
          collectionId: 'test',
          collectionToken: 'token'
        }

        fetchCardsFromSearch.mockResolvedValue([])
        processCardsCollectionMode.mockResolvedValue({
          cardsProcessed: 0,
          boardsFound: 0
        })

        await sourceNodes(mockGatsbyFunctions, pluginOptions)

        expect(processCardsCollectionMode).toHaveBeenCalledWith(
          [],
          pluginOptions,
          expect.any(Object),
          false, // downloadAttachments default
          'static/guru-attachments', // attachmentDir default
          expect.any(Function),
          expect.any(Function),
          expect.any(Function)
        )
      })

      it('should handle missing teamName in user mode', async () => {
        const pluginOptions = {
          authMode: 'user',
          apiUsername: 'testuser',
          apiPassword: 'testpass'
          // teamName missing
        }

        const mockCards = []
        fetchCardsFromTeam.mockResolvedValue(mockCards)
        processCardsUserMode.mockResolvedValue({ cardsProcessed: 0 })

        await sourceNodes(mockGatsbyFunctions, pluginOptions)

        expect(fetchCardsFromTeam).toHaveBeenCalledWith(undefined, pluginOptions)
      })
    })

    describe('logging', () => {
      it('should log auth mode', async () => {
        const pluginOptions = {
          authMode: 'collection',
          collectionId: 'test',
          collectionToken: 'token'
        }

        fetchCardsFromSearch.mockResolvedValue([])
        processCardsCollectionMode.mockResolvedValue({
          cardsProcessed: 0,
          boardsFound: 0
        })

        const consoleSpy = jest.spyOn(console, 'log').mockImplementation()

        await sourceNodes(mockGatsbyFunctions, pluginOptions)

        expect(consoleSpy).toHaveBeenCalledWith('Guru Plugin: Starting data fetch...')
        expect(consoleSpy).toHaveBeenCalledWith('Auth mode: collection')

        consoleSpy.mockRestore()
      })

      it('should default to user mode when authMode not specified', async () => {
        const pluginOptions = {
          apiUsername: 'testuser',
          apiPassword: 'testpass',
          teamName: 'testteam'
        }

        fetchCardsFromTeam.mockResolvedValue([])
        processCardsUserMode.mockResolvedValue({ cardsProcessed: 0 })

        const consoleSpy = jest.spyOn(console, 'log').mockImplementation()

        await sourceNodes(mockGatsbyFunctions, pluginOptions)

        expect(consoleSpy).toHaveBeenCalledWith('Auth mode: user')

        consoleSpy.mockRestore()
      })
    })
  })
})