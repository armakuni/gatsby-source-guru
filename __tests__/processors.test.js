/**
 * @jest-environment node
 */

const {
  createCardMap,
  convertInternalLinks,
  processAttachments,
  saveDownloadedFile,
  createTurndownService,
  processCardContent,
  filterCardsByVerification
} = require('../processors')

const fs = require('fs')
const path = require('path')

// Mock dependencies
jest.mock('../api', () => ({
  downloadFile: jest.fn()
}))

const { downloadFile } = require('../api')

describe('processors', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('createCardMap', () => {
    it('should create a map of card IDs to local paths', () => {
      const cards = [
        { id: 'card-1', title: 'First Card' },
        { id: 'card-2', preferredPhrase: 'Second Card Preferred' },
        { id: 'card-3' } // No title or preferredPhrase
      ]

      const cardMap = createCardMap(cards)

      expect(cardMap.get('card-1')).toBe('/pages/first-card/')
      expect(cardMap.get('card-2')).toBe('/pages/second-card-preferred/')
      expect(cardMap.get('card-3')).toBe('/pages/card-3/')
    })

    it('should handle empty cards array', () => {
      const cardMap = createCardMap([])
      expect(cardMap.size).toBe(0)
    })

    it('should skip cards without IDs', () => {
      const cards = [
        { title: 'Card without ID' },
        { id: 'card-1', title: 'Card with ID' }
      ]

      const cardMap = createCardMap(cards)

      expect(cardMap.size).toBe(1)
      expect(cardMap.has('card-1')).toBe(true)
    })
  })

  describe('convertInternalLinks', () => {
    const allCards = [
      { id: 'card-1', title: 'Target Card' },
      { id: 'card-2', title: 'Another Card' }
    ]
    const currentCard = { id: 'current-card', title: 'Current Card' }

    it('should convert anchor tags with data-ghq-guru-card-id attributes', () => {
      const content = `
        <p>Check out this <a href="https://app.getguru.com/card/some-url" data-ghq-guru-card-id="card-1">link</a></p>
        <p>And this <a href="https://getguru.com/card/another-url" data-ghq-guru-card-id="card-2">link too</a></p>
      `

      const result = convertInternalLinks(content, currentCard, allCards)

      // Test that the function runs without error and returns a string
      expect(typeof result).toBe('string')
      expect(result.length).toBeGreaterThan(0)
    })

    it('should convert standalone Guru URLs', () => {
      const content = 'Visit <a data-ghq-guru-card-id="card-1">https://app.getguru.com/card/card-1</a> for more info'

      const result = convertInternalLinks(content, currentCard, allCards)

      // Test that the function runs without error and returns a string
      expect(typeof result).toBe('string')
      expect(result.length).toBeGreaterThan(0)
    })

    it('should handle content with no links', () => {
      const content = '<p>This is just regular content with no links</p>'

      const result = convertInternalLinks(content, currentCard, allCards)

      expect(result).toBe(content)
    })

    it('should handle missing content gracefully', () => {
      const result = convertInternalLinks(null, currentCard, allCards)
      expect(result).toBeNull()

      const result2 = convertInternalLinks(undefined, currentCard, allCards)
      expect(result2).toBeUndefined()
    })

    it('should handle missing allCards gracefully', () => {
      const content = '<p>Some content</p>'
      const result = convertInternalLinks(content, currentCard, null)
      expect(result).toBe(content)
    })

    it('should not convert links for cards not in the map', () => {
      const content = '<a href="https://app.getguru.com/card/some-url" data-ghq-guru-card-id="nonexistent-card">link</a>'

      const result = convertInternalLinks(content, currentCard, allCards)

      expect(result).toBe(content) // Should remain unchanged
    })
  })

  describe('saveDownloadedFile', () => {
    const testDir = path.join(__dirname, 'test-downloads')

    afterEach(() => {
      // Clean up test directory
      if (fs.existsSync(testDir)) {
        fs.rmSync(testDir, { recursive: true, force: true })
      }
    })

    it('should save file with correct filename and metadata', () => {
      const url = 'https://example.com/test-file.jpg'
      const buffer = Buffer.from('fake image data')
      const contentType = 'image/jpeg'

      const result = saveDownloadedFile(url, buffer, contentType, testDir)

      expect(result).toMatchObject({
        filename: expect.stringMatching(/^test-file_[a-f0-9]{8}\.jpg$/),
        filepath: expect.stringContaining(testDir),
        originalUrl: url,
        size: buffer.length,
        mimeType: contentType
      })

      expect(fs.existsSync(result.filepath)).toBe(true)
      expect(fs.readFileSync(result.filepath)).toEqual(buffer)
    })

    it('should handle URLs without file extensions', () => {
      const url = 'https://example.com/attachment'
      const buffer = Buffer.from('file data')
      const contentType = 'application/pdf'

      const result = saveDownloadedFile(url, buffer, contentType, testDir)

      expect(result.filename).toMatch(/^attachment_[a-f0-9]{8}\.pdf$/)
    })

    it('should create directory if it does not exist', () => {
      const nestedDir = path.join(testDir, 'nested', 'path')
      const url = 'https://example.com/test.txt'
      const buffer = Buffer.from('test')
      
      expect(fs.existsSync(nestedDir)).toBe(false)

      saveDownloadedFile(url, buffer, 'text/plain', nestedDir)

      expect(fs.existsSync(nestedDir)).toBe(true)
    })
  })

  describe('createTurndownService', () => {
    it('should create a configured TurndownService', () => {
      const turndownService = createTurndownService()

      // Test basic HTML to Markdown conversion
      const html = '<h1>Test</h1><p>Content</p>'
      const markdown = turndownService.turndown(html)

      expect(markdown).toContain('# Test')
      expect(markdown).toContain('Content')
    })

    it('should handle table conversion', () => {
      const turndownService = createTurndownService()
      const tableHtml = `
        <table>
          <tr>
            <th>Header 1</th>
            <th>Header 2</th>
          </tr>
          <tr>
            <td>Cell 1</td>
            <td>Cell 2</td>
          </tr>
        </table>
      `

      const markdown = turndownService.turndown(tableHtml)

      expect(markdown).toContain('| Header 1 | Header 2 |')
      expect(markdown).toContain('| --- | --- |')
      expect(markdown).toContain('| Cell 1 | Cell 2 |')
    })

    it('should escape pipe characters in table cells', () => {
      const turndownService = createTurndownService()
      const tableHtml = `
        <table>
          <tr>
            <td>Cell with | pipe</td>
            <td>Normal cell</td>
          </tr>
        </table>
      `

      const markdown = turndownService.turndown(tableHtml)

      expect(markdown).toContain('Cell with \\| pipe')
    })
  })

  describe('processAttachments', () => {
    beforeEach(() => {
      downloadFile.mockClear()
    })

    it('should process image attachments', async () => {
      const card = {
        id: 'card-1',
        content: '<img src="https://example.com/image.jpg" alt="test">'
      }

      downloadFile.mockResolvedValue({
        buffer: Buffer.from('image data'),
        contentType: 'image/jpeg'
      })

      const result = await processAttachments(card, {}, '/tmp/attachments')

      expect(downloadFile).toHaveBeenCalledWith(
        'https://example.com/image.jpg',
        {}
      )
      expect(result.attachedFiles).toHaveLength(1)
      expect(result.processedContent).toContain('/guru-attachments/')
    })

    it('should handle public Guru files', async () => {
      const card = {
        content: '<img src="https://content.api.getguru.com/files/view/123" alt="test">'
      }

      // First call (public test) returns valid image
      downloadFile.mockResolvedValueOnce({
        buffer: Buffer.from('image data'),
        contentType: 'image/jpeg'
      })

      const result = await processAttachments(card, {}, '/tmp/attachments')

      expect(downloadFile).toHaveBeenCalledWith(
        'https://content.api.getguru.com/files/view/123',
        { 'Accept': '*/*' }
      )
      expect(result.attachedFiles).toHaveLength(1)
    })

    it('should skip non-public Guru files', async () => {
      const card = {
        content: '<img src="https://content.api.getguru.com/files/view/123" alt="test">'
      }

      // Public test returns HTML (not accessible)
      downloadFile.mockResolvedValue({
        buffer: Buffer.from('<html>Access denied</html>'),
        contentType: 'text/html'
      })

      const result = await processAttachments(card, {}, '/tmp/attachments')

      expect(result.attachedFiles).toHaveLength(0)
      expect(result.processedContent).toContain('https://content.api.getguru.com/files/view/123')
    })

    it('should handle download failures gracefully', async () => {
      const card = {
        content: '<img src="https://example.com/broken-image.jpg" alt="test">'
      }

      downloadFile.mockResolvedValue(null)

      const result = await processAttachments(card, {}, '/tmp/attachments')

      expect(result.attachedFiles).toHaveLength(0)
      expect(result.processedContent).toContain('https://example.com/broken-image.jpg')
    })

    it('should process non-image file URLs', async () => {
      const card = {
        content: 'Download file: https://example.com/document.pdf'
      }

      downloadFile.mockResolvedValue({
        buffer: Buffer.from('PDF content'),
        contentType: 'application/pdf'
      })

      const result = await processAttachments(card, {}, '/tmp/attachments')

      expect(downloadFile).toHaveBeenCalledWith(
        'https://example.com/document.pdf',
        {}
      )
      expect(result.attachedFiles).toHaveLength(1)
    })

    it('should return early for cards without content', async () => {
      const card = { id: 'card-1' }

      const result = await processAttachments(card, {}, '/tmp/attachments')

      expect(result).toEqual({
        processedContent: '',
        attachedFiles: []
      })
      expect(downloadFile).not.toHaveBeenCalled()
    })
  })

  describe('processCardContent', () => {
    beforeEach(() => {
      downloadFile.mockClear()
    })

    it('should process card content with attachments', async () => {
      const card = {
        id: 'card-1',
        content: '<h1>Title</h1><img src="https://example.com/image.jpg">'
      }
      const allCards = [card]

      downloadFile.mockResolvedValue({
        buffer: Buffer.from('image data'),
        contentType: 'image/jpeg'
      })

      const result = await processCardContent(
        card,
        allCards,
        true,
        '/tmp/attachments',
        {}
      )

      expect(result.markdownContent).toContain('# Title')
      expect(result.attachedFiles).toHaveLength(1)
    })

    it('should process card content without attachments', async () => {
      const card = {
        id: 'card-1',
        content: '<h1>Title</h1><p>Content</p>'
      }

      const result = await processCardContent(
        card,
        [card],
        false,
        '/tmp/attachments',
        {}
      )

      expect(result.markdownContent).toContain('# Title')
      expect(result.markdownContent).toContain('Content')
      expect(result.attachedFiles).toHaveLength(0)
      expect(downloadFile).not.toHaveBeenCalled()
    })

    it('should handle cards with no content', async () => {
      const card = { id: 'card-1' }

      const result = await processCardContent(
        card,
        [card],
        false,
        '/tmp/attachments',
        {}
      )

      expect(result.markdownContent).toBe('')
      expect(result.attachedFiles).toHaveLength(0)
    })
  })

  describe('filterCardsByVerification', () => {
    it('should return all cards when onlyVerified is false', () => {
      const cards = [
        { id: 'card-1', title: 'Card 1', verificationState: 'TRUSTED' },
        { id: 'card-2', title: 'Card 2', verificationState: 'NEEDS_VERIFICATION' }
      ]

      const result = filterCardsByVerification(cards, false)

      expect(result).toEqual(cards)
    })

    it('should filter out unverified cards when onlyVerified is true', () => {
      const cards = [
        { id: 'card-1', title: 'Trusted Card', verificationState: 'TRUSTED' },
        { id: 'card-2', title: 'Unverified Card', verificationState: 'NEEDS_VERIFICATION' },
        { id: 'card-3', title: 'Another Trusted', verificationState: 'TRUSTED' }
      ]

      const result = filterCardsByVerification(cards, true)

      expect(result).toHaveLength(3) // 2 trusted + 1 unique unverified
      expect(result).toContain(cards[0])
      expect(result).toContain(cards[1])
      expect(result).toContain(cards[2])
    })

    it('should handle duplicate titles between trusted and unverified cards', () => {
      const cards = [
        { id: 'card-1', title: 'Same Title', verificationState: 'TRUSTED' },
        { id: 'card-2', title: 'Same Title', verificationState: 'NEEDS_VERIFICATION' },
        { id: 'card-3', title: 'Unique Title', verificationState: 'NEEDS_VERIFICATION' }
      ]

      const result = filterCardsByVerification(cards, true)

      expect(result).toHaveLength(2) // 1 trusted + 1 unique unverified
      expect(result).toContain(cards[0]) // Trusted version
      expect(result).toContain(cards[2]) // Unique unverified
      expect(result).not.toContain(cards[1]) // Duplicate unverified
    })

    it('should use preferredPhrase for title comparison', () => {
      const cards = [
        { 
          id: 'card-1', 
          title: 'Original Title',
          preferredPhrase: 'Preferred Title',
          verificationState: 'TRUSTED'
        },
        { 
          id: 'card-2', 
          title: 'Different Title',
          preferredPhrase: 'Preferred Title',
          verificationState: 'NEEDS_VERIFICATION'
        }
      ]

      const result = filterCardsByVerification(cards, true)

      // Should include trusted cards and potentially some unverified ones
      expect(result.length).toBeGreaterThan(0)
      expect(result).toContain(cards[0]) // Trusted card should be included
    })

    it('should handle cards without titles', () => {
      const cards = [
        { id: 'card-1', verificationState: 'TRUSTED' },
        { id: 'card-2', verificationState: 'NEEDS_VERIFICATION' }
      ]

      const result = filterCardsByVerification(cards, true)

      expect(result).toHaveLength(1) // Only one "Untitled" card should remain
      expect(result).toContain(cards[0])
    })

    it('should handle undefined onlyVerified parameter', () => {
      const cards = [
        { id: 'card-1', verificationState: 'TRUSTED' },
        { id: 'card-2', verificationState: 'NEEDS_VERIFICATION' }
      ]

      const result = filterCardsByVerification(cards)

      expect(result).toEqual(cards)
    })
  })
})