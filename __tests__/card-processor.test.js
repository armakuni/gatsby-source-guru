/**
 * @jest-environment node
 */

const {
  createCardNodeData,
  processAndCreateCardNode,
  processCardsCollectionMode,
  processCardsUserMode,
  createCollectionNode,
  createBoardNode
} = require('../card-processor')

// Mock dependencies
jest.mock('../processors', () => ({
  processCardContent: jest.fn(),
  filterCardsByVerification: jest.fn()
}))

jest.mock('../api', () => ({
  fetchBoardParents: jest.fn()
}))

const { processCardContent, filterCardsByVerification } = require('../processors')
const { fetchBoardParents } = require('../api')

describe('card-processor', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('createCardNodeData', () => {
    const mockCreateNodeId = jest.fn((input) => `node-${input}`)
    const mockCreateContentDigest = jest.fn((input) => `digest-${JSON.stringify(input).length}`)

    it('should create node data with all required fields', () => {
      const card = {
        id: 'card-123',
        title: 'Test Card',
        content: '<p>Test content</p>',
        owner: { firstName: 'John', lastName: 'Doe' },
        lastModifiedBy: { firstName: 'Jane', lastName: 'Smith' },
        boards: [{ id: 'board-1', title: 'Test Board' }],
        verificationState: 'TRUSTED'
      }
      
      const markdownContent = 'Test content'
      const attachedFiles = []
      const boardsWithParentInfo = [{ id: 'board-1', title: 'Test Board', parentFolder: null }]

      const result = createCardNodeData(
        card,
        markdownContent,
        attachedFiles,
        boardsWithParentInfo,
        mockCreateNodeId,
        mockCreateContentDigest
      )

      expect(result).toMatchObject({
        id: 'node-guru-card-card-123',
        title: 'Test Card',
        content: markdownContent,
        contentHtml: '<p>Test content</p>',
        attachedFiles: [],
        slug: 'test-card',
        boards: boardsWithParentInfo,
        owner: 'John Doe',
        lastModifiedBy: 'Jane Smith',
        parent: null,
        children: [],
        internal: {
          type: 'GuruCard',
          content: expect.any(String),
          contentDigest: expect.any(String)
        }
      })
    })

    it('should use preferredPhrase over title when available', () => {
      const card = {
        id: 'card-123',
        title: 'Original Title',
        preferredPhrase: 'Preferred Title',
        content: '<p>Test content</p>',
        owner: null,
        lastModifiedBy: null
      }

      const result = createCardNodeData(
        card,
        'Test content',
        [],
        [],
        mockCreateNodeId,
        mockCreateContentDigest
      )

      expect(result.title).toBe('Preferred Title')
      expect(result.slug).toBe('preferred-title')
    })

    it('should handle missing title gracefully', () => {
      const card = {
        id: 'card-123',
        content: '<p>Test content</p>',
        owner: null,
        lastModifiedBy: null
      }

      const result = createCardNodeData(
        card,
        'Test content',
        [],
        [],
        mockCreateNodeId,
        mockCreateContentDigest
      )

      expect(result.title).toBe('Untitled Card')
      expect(result.slug).toBe('card-123')
    })

    it('should format user names correctly', () => {
      const card = {
        id: 'card-123',
        title: 'Test Card',
        owner: { firstName: 'John' },
        lastModifiedBy: 'Jane Doe'
      }

      const result = createCardNodeData(
        card,
        'Test content',
        [],
        [],
        mockCreateNodeId,
        mockCreateContentDigest
      )

      expect(result.owner).toBe('John')
      expect(result.lastModifiedBy).toBe('Jane Doe')
    })
  })

  describe('processAndCreateCardNode', () => {
    const mockGatsbyFunctions = {
      createNodeId: jest.fn((input) => `node-${input}`),
      createContentDigest: jest.fn((input) => `digest-${JSON.stringify(input).length}`),
      createNode: jest.fn()
    }

    beforeEach(() => {
      mockGatsbyFunctions.createNode.mockClear()
      processCardContent.mockResolvedValue({
        markdownContent: 'Processed markdown',
        attachedFiles: []
      })
    })

    it('should process card content and create node', async () => {
      const card = {
        id: 'card-123',
        title: 'Test Card',
        boards: [{ id: 'board-1', title: 'Test Board' }]
      }
      const allCards = [card]
      const headers = { Authorization: 'Basic test' }
      const boardsWithParents = new Map([
        ['board-1', { id: 'board-1', title: 'Test Board', parentFolder: null }]
      ])

      const result = await processAndCreateCardNode(
        card,
        allCards,
        true,
        '/tmp/attachments',
        headers,
        mockGatsbyFunctions.createNodeId,
        mockGatsbyFunctions.createContentDigest,
        mockGatsbyFunctions.createNode,
        boardsWithParents
      )

      expect(processCardContent).toHaveBeenCalledWith(
        card,
        allCards,
        true,
        '/tmp/attachments',
        headers
      )
      expect(mockGatsbyFunctions.createNode).toHaveBeenCalledTimes(1)
      expect(result).toMatchObject({
        id: 'node-guru-card-card-123',
        title: 'Test Card',
        content: 'Processed markdown'
      })
    })

    it('should handle cards without boards', async () => {
      const card = {
        id: 'card-123',
        title: 'Test Card'
      }

      await processAndCreateCardNode(
        card,
        [card],
        false,
        '/tmp/attachments',
        {},
        mockGatsbyFunctions.createNodeId,
        mockGatsbyFunctions.createContentDigest,
        mockGatsbyFunctions.createNode
      )

      expect(mockGatsbyFunctions.createNode).toHaveBeenCalledWith(
        expect.objectContaining({
          boards: []
        })
      )
    })
  })

  describe('processCardsCollectionMode', () => {
    const mockGatsbyFunctions = {
      createNodeId: jest.fn((input) => `node-${input}`),
      createContentDigest: jest.fn((input) => `digest-${input}`),
      createNode: jest.fn()
    }

    beforeEach(() => {
      mockGatsbyFunctions.createNode.mockClear()
      fetchBoardParents.mockResolvedValue(new Map())
      filterCardsByVerification.mockImplementation((cards) => cards)
      processCardContent.mockResolvedValue({
        markdownContent: 'Test markdown',
        attachedFiles: []
      })
    })

    it('should process cards and fetch board parents', async () => {
      const searchResults = [
        {
          id: 'card-1',
          title: 'Card 1',
          boards: [{ id: 'board-1', title: 'Board 1' }]
        },
        {
          id: 'card-2',
          title: 'Card 2',
          boards: [{ id: 'board-2', title: 'Board 2' }]
        }
      ]

      const pluginOptions = { onlyVerified: false }
      const headers = { Authorization: 'Basic test' }

      const result = await processCardsCollectionMode(
        searchResults,
        pluginOptions,
        headers,
        false,
        '/tmp/attachments',
        mockGatsbyFunctions.createNodeId,
        mockGatsbyFunctions.createContentDigest,
        mockGatsbyFunctions.createNode
      )

      expect(fetchBoardParents).toHaveBeenCalledWith(
        expect.any(Map),
        headers
      )
      expect(filterCardsByVerification).toHaveBeenCalledWith(
        searchResults,
        false
      )
      expect(mockGatsbyFunctions.createNode).toHaveBeenCalledTimes(2)
      expect(result).toEqual({
        cardsProcessed: 2,
        boardsFound: 2
      })
    })

    it('should handle empty search results', async () => {
      const result = await processCardsCollectionMode(
        [],
        {},
        {},
        false,
        '/tmp/attachments',
        mockGatsbyFunctions.createNodeId,
        mockGatsbyFunctions.createContentDigest,
        mockGatsbyFunctions.createNode
      )

      expect(result).toEqual({
        cardsProcessed: 0,
        boardsFound: 0
      })
      expect(mockGatsbyFunctions.createNode).not.toHaveBeenCalled()
    })

    it('should filter cards when onlyVerified is enabled', async () => {
      const searchResults = [
        { id: 'card-1', title: 'Card 1', verificationState: 'TRUSTED' },
        { id: 'card-2', title: 'Card 2', verificationState: 'NEEDS_VERIFICATION' }
      ]

      filterCardsByVerification.mockReturnValue([searchResults[0]])

      const result = await processCardsCollectionMode(
        searchResults,
        { onlyVerified: true },
        {},
        false,
        '/tmp/attachments',
        mockGatsbyFunctions.createNodeId,
        mockGatsbyFunctions.createContentDigest,
        mockGatsbyFunctions.createNode
      )

      expect(filterCardsByVerification).toHaveBeenCalledWith(
        searchResults,
        true
      )
      expect(result.cardsProcessed).toBe(1)
    })
  })

  describe('processCardsUserMode', () => {
    const mockGatsbyFunctions = {
      createNodeId: jest.fn((input) => `node-${input}`),
      createContentDigest: jest.fn((input) => `digest-${input}`),
      createNode: jest.fn()
    }

    beforeEach(() => {
      mockGatsbyFunctions.createNode.mockClear()
      filterCardsByVerification.mockImplementation((cards) => cards)
      processCardContent.mockResolvedValue({
        markdownContent: 'Test markdown',
        attachedFiles: []
      })
    })

    it('should process cards in user mode', async () => {
      const cards = [
        { id: 'card-1', title: 'Card 1' },
        { id: 'card-2', title: 'Card 2' }
      ]

      const result = await processCardsUserMode(
        cards,
        { onlyVerified: false },
        false,
        '/tmp/attachments',
        {},
        mockGatsbyFunctions.createNodeId,
        mockGatsbyFunctions.createContentDigest,
        mockGatsbyFunctions.createNode
      )

      expect(filterCardsByVerification).toHaveBeenCalledWith(cards, false)
      expect(mockGatsbyFunctions.createNode).toHaveBeenCalledTimes(2)
      expect(result).toEqual({
        cardsProcessed: 2
      })
    })
  })

  describe('createCollectionNode', () => {
    const mockGatsbyFunctions = {
      createNodeId: jest.fn((input) => `node-${input}`),
      createContentDigest: jest.fn((input) => `digest-${typeof input === 'object' ? input.id : input}`),
      createNode: jest.fn()
    }

    it('should create collection node with correct structure', () => {
      const collection = {
        id: 'collection-123',
        name: 'Test Collection',
        description: 'A test collection'
      }

      const result = createCollectionNode(
        collection,
        mockGatsbyFunctions.createNodeId,
        mockGatsbyFunctions.createContentDigest,
        mockGatsbyFunctions.createNode
      )

      expect(result).toEqual({
        ...collection,
        id: 'node-guru-collection-collection-123',
        parent: null,
        children: [],
        internal: {
          type: 'GuruCollection',
          content: JSON.stringify(collection),
          contentDigest: 'digest-collection-123'
        }
      })
      expect(mockGatsbyFunctions.createNode).toHaveBeenCalledWith(expect.objectContaining({
        id: 'node-guru-collection-collection-123',
        internal: {
          type: 'GuruCollection',
          content: JSON.stringify(collection),
          contentDigest: 'digest-collection-123'
        }
      }))
    })
  })

  describe('createBoardNode', () => {
    const mockGatsbyFunctions = {
      createNodeId: jest.fn((input) => `node-${input}`),
      createContentDigest: jest.fn((input) => `digest-${typeof input === 'object' ? input.id : input}`),
      createNode: jest.fn()
    }

    it('should create board node with correct structure', () => {
      const board = {
        id: 'board-123',
        title: 'Test Board',
        parentFolder: null
      }

      const result = createBoardNode(
        board,
        mockGatsbyFunctions.createNodeId,
        mockGatsbyFunctions.createContentDigest,
        mockGatsbyFunctions.createNode
      )

      expect(result).toEqual({
        ...board,
        id: 'node-guru-board-board-123',
        parent: null,
        children: [],
        internal: {
          type: 'GuruBoard',
          content: JSON.stringify(board),
          contentDigest: 'digest-board-123'
        }
      })
      expect(mockGatsbyFunctions.createNode).toHaveBeenCalledWith(expect.objectContaining({
        id: 'node-guru-board-board-123',
        internal: {
          type: 'GuruBoard',
          content: JSON.stringify(board),
          contentDigest: 'digest-board-123'
        }
      }))
    })
  })
})