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

describe('processors - edge cases and error handling', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('createCardMap - edge cases', () => {
    it('should handle cards with special characters in titles', () => {
      const cards = [
        { id: 'card-1', title: 'Test & Card with "Quotes" and <HTML>' },
        { id: 'card-2', title: 'Card with émojis 🚀 and ñumbers 123' },
        { id: 'card-3', title: '   Whitespace   Card   ' }
      ]

      const cardMap = createCardMap(cards)

      expect(cardMap.get('card-1')).toBe('/pages/test-card-with-quotes-and-html/')
      expect(cardMap.get('card-2')).toBe('/pages/card-with-emojis-and-numbers-123/')
      expect(cardMap.get('card-3')).toBe('/pages/whitespace-card/')
    })

    it('should handle very long titles', () => {
      const longTitle = 'A'.repeat(200)
      const cards = [{ id: 'card-1', title: longTitle }]

      const cardMap = createCardMap(cards)

      expect(cardMap.get('card-1')).toBe(`/pages/${'a'.repeat(200)}/`)
    })

    it('should handle cards with only special characters in titles', () => {
      const cards = [
        { id: 'card-1', title: '!@#$%^&*()' },
        { id: 'card-2', title: '   ---   ' },
        { id: 'card-3', title: '' }
      ]

      const cardMap = createCardMap(cards)

      expect(cardMap.get('card-1')).toBe('/pages/card-1/')
      expect(cardMap.get('card-2')).toBe('/pages/card-2/')
      expect(cardMap.get('card-3')).toBe('/pages/card-3/')
    })
  })

  describe('convertInternalLinks - comprehensive coverage', () => {
    const allCards = [
      { id: 'card-1', title: 'Target Card' },
      { id: 'card-2', title: 'Another Card' }
    ]
    const currentCard = { id: 'current-card', title: 'Current Card' }

    it('should handle complex HTML structures', () => {
      const content = `
        <div class="complex-structure">
          <p>Nested content with <a href="https://app.getguru.com/card/some-url" 
             data-ghq-guru-card-id="card-1" class="link-class" target="_blank">
             complex link
          </a></p>
          <ul>
            <li>Item with <a href="https://getguru.com/card/another" 
                data-ghq-guru-card-id="card-2">another link</a></li>
          </ul>
        </div>
      `

      const result = convertInternalLinks(content, currentCard, allCards)

      expect(result).toContain('/pages/target-card/')
      expect(result).toContain('/pages/another-card/')
      expect(result).toContain('class="link-class"')
      expect(result).toContain('target="_blank"')
    })

    it('should handle malformed HTML gracefully', () => {
      const content = `
        <p>Broken HTML <a href="https://app.getguru.com/card/test" 
           data-ghq-guru-card-id="card-1" unclosed link
        <div>More broken HTML</div>
      `

      const result = convertInternalLinks(content, currentCard, allCards)

      // Should not crash and should attempt to convert what it can
      expect(result).toBeDefined()
      expect(typeof result).toBe('string')
    })

    it('should handle empty card IDs', () => {
      const content = `
        <a href="https://app.getguru.com/card/test" data-ghq-guru-card-id="">empty id</a>
        <a href="https://app.getguru.com/card/test" data-ghq-guru-card-id="   ">whitespace id</a>
      `

      const result = convertInternalLinks(content, currentCard, allCards)

      // Should not convert links with empty/whitespace IDs
      expect(result).toContain('https://app.getguru.com/card/test')
    })

    it('should handle multiple links to the same card', () => {
      const content = `
        <p>First link: <a href="https://app.getguru.com/card/url1" data-ghq-guru-card-id="card-1">Link 1</a></p>
        <p>Second link: <a href="https://getguru.com/card/url2" data-ghq-guru-card-id="card-1">Link 2</a></p>
        <p>Third link: <a href="https://app.getguru.com/card/url3" data-ghq-guru-card-id="card-1">Link 3</a></p>
      `

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation()

      const result = convertInternalLinks(content, currentCard, allCards)

      expect(result).toContain('/pages/target-card/')
      expect(result).not.toContain('https://app.getguru.com/card/')
      expect(result).not.toContain('https://getguru.com/card/')

      // Should log that links were converted
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Converted 3 internal links')
      )

      consoleSpy.mockRestore()
    })

    it('should handle very large content efficiently', () => {
      const largeContent = `
        <div>${'<p>Some content</p>'.repeat(1000)}</div>
        <a href="https://app.getguru.com/card/test" data-ghq-guru-card-id="card-1">Link</a>
        <div>${'<p>More content</p>'.repeat(1000)}</div>
      `

      const startTime = Date.now()
      const result = convertInternalLinks(largeContent, currentCard, allCards)
      const endTime = Date.now()

      expect(result).toContain('/pages/target-card/')
      expect(endTime - startTime).toBeLessThan(1000) // Should complete in less than 1 second
    })

    it('should preserve HTML structure and attributes', () => {
      const content = `
        <a href="https://app.getguru.com/card/test" 
           data-ghq-guru-card-id="card-1"
           class="custom-class"
           id="link-id"
           target="_blank"
           rel="noopener"
           title="Link Title">
          Link Text
        </a>
      `

      const result = convertInternalLinks(content, currentCard, allCards)

      expect(result).toContain('href="/pages/target-card/"')
      expect(result).toContain('class="custom-class"')
      expect(result).toContain('id="link-id"')
      expect(result).toContain('target="_blank"')
      expect(result).toContain('rel="noopener"')
      expect(result).toContain('title="Link Title"')
      expect(result).toContain('Link Text')
    })
  })

  describe('saveDownloadedFile - comprehensive coverage', () => {
    const testDir = path.join(__dirname, 'test-edge-cases')

    afterEach(() => {
      if (fs.existsSync(testDir)) {
        fs.rmSync(testDir, { recursive: true, force: true })
      }
    })

    it('should handle files with no extension and unknown content type', () => {
      const url = 'https://example.com/mysterious-file'
      const buffer = Buffer.from('mysterious content')
      const contentType = 'application/octet-stream'

      const result = saveDownloadedFile(url, buffer, contentType, testDir)

      expect(result.filename).toMatch(/^mysterious-file_[a-f0-9]{8}$/)
      expect(fs.existsSync(result.filepath)).toBe(true)
    })

    it('should handle very long URLs', () => {
      const longPath = '/very/long/path/' + 'segment/'.repeat(20) + 'file.txt'
      const url = `https://example.com${longPath}`
      const buffer = Buffer.from('content')

      const result = saveDownloadedFile(url, buffer, 'text/plain', testDir)

      expect(result.filename).toMatch(/^file_[a-f0-9]{8}\.txt$/)
      expect(fs.existsSync(result.filepath)).toBe(true)
    })

    it('should handle URLs with query parameters and fragments', () => {
      const url = 'https://example.com/file.pdf?version=1.2&download=true#section1'
      const buffer = Buffer.from('PDF content')

      const result = saveDownloadedFile(url, buffer, 'application/pdf', testDir)

      expect(result.filename).toMatch(/^file_[a-f0-9]{8}\.pdf$/)
    })

    it('should handle special characters in URLs', () => {
      const url = 'https://example.com/文档.pdf'
      const buffer = Buffer.from('content')

      const result = saveDownloadedFile(url, buffer, 'application/pdf', testDir)

      expect(result.filename).toMatch(/^文档_[a-f0-9]{8}\.pdf$/)
    })

    it('should handle empty buffers', () => {
      const url = 'https://example.com/empty.txt'
      const buffer = Buffer.from('')

      const result = saveDownloadedFile(url, buffer, 'text/plain', testDir)

      expect(result.size).toBe(0)
      expect(fs.existsSync(result.filepath)).toBe(true)
      expect(fs.readFileSync(result.filepath)).toEqual(buffer)
    })

    it('should handle very large buffers', () => {
      const url = 'https://example.com/large.bin'
      const buffer = Buffer.alloc(1024 * 1024, 'a') // 1MB buffer

      const result = saveDownloadedFile(url, buffer, 'application/octet-stream', testDir)

      expect(result.size).toBe(1024 * 1024)
      expect(fs.existsSync(result.filepath)).toBe(true)
    })
  })

  describe('createTurndownService - edge cases', () => {
    it('should handle nested tables correctly', () => {
      const turndownService = createTurndownService()
      const nestedTableHtml = `
        <table>
          <tr><th>Header</th></tr>
          <tr><td>
            <table>
              <tr><td>Nested</td></tr>
            </table>
          </td></tr>
        </table>
      `

      const markdown = turndownService.turndown(nestedTableHtml)

      expect(markdown).toContain('| Header |')
      expect(markdown).toContain('Nested')
    })

    it('should handle tables with empty cells', () => {
      const turndownService = createTurndownService()
      const tableHtml = `
        <table>
          <tr>
            <th>Header 1</th>
            <th></th>
            <th>Header 3</th>
          </tr>
          <tr>
            <td></td>
            <td>Content</td>
            <td></td>
          </tr>
        </table>
      `

      const markdown = turndownService.turndown(tableHtml)

      expect(markdown).toContain('| Header 1 |  | Header 3 |')
      expect(markdown).toContain('|  | Content |  |')
    })

    it('should handle tables with complex cell content', () => {
      const turndownService = createTurndownService()
      const tableHtml = `
        <table>
          <tr>
            <td>
              <p>Paragraph 1</p>
              <p>Paragraph 2</p>
            </td>
            <td>
              <ul><li>List item</li></ul>
            </td>
          </tr>
        </table>
      `

      const markdown = turndownService.turndown(tableHtml)

      expect(markdown).toContain('Paragraph 1<br>Paragraph 2')
    })

    it('should handle malformed table structures', () => {
      const turndownService = createTurndownService()
      const malformedHtml = `
        <table>
          <td>Orphan cell</td>
          <tr>
            <th>Header
            <td>Missing closing tag
          </tr>
        </table>
      `

      const markdown = turndownService.turndown(malformedHtml)
      
      // Should not crash
      expect(typeof markdown).toBe('string')
    })

    it('should handle very wide tables', () => {
      const turndownService = createTurndownService()
      const wideCells = Array(20).fill().map((_, i) => `<th>Header ${i}</th>`).join('')
      const wideData = Array(20).fill().map((_, i) => `<td>Data ${i}</td>`).join('')
      
      const wideTableHtml = `
        <table>
          <tr>${wideCells}</tr>
          <tr>${wideData}</tr>
        </table>
      `

      const markdown = turndownService.turndown(wideTableHtml)

      expect(markdown).toContain('| Header 0 |')
      expect(markdown).toContain('| Header 19 |')
      expect(markdown).toContain('| Data 0 |')
      expect(markdown).toContain('| Data 19 |')
    })
  })

  describe('processAttachments - error handling', () => {
    beforeEach(() => {
      downloadFile.mockClear()
    })

    it('should handle mixed success and failure downloads', async () => {
      const card = {
        id: 'card-1',
        content: `
          <img src="https://example.com/success.jpg" alt="success">
          <img src="https://example.com/failure.jpg" alt="failure">
          <img src="https://example.com/another-success.png" alt="success2">
        `
      }

      downloadFile
        .mockResolvedValueOnce({
          buffer: Buffer.from('success'),
          contentType: 'image/jpeg'
        })
        .mockResolvedValueOnce(null) // failure
        .mockResolvedValueOnce({
          buffer: Buffer.from('success2'),
          contentType: 'image/png'
        })

      const result = await processAttachments(card, {}, '/tmp/test')

      expect(result.attachedFiles).toHaveLength(2)
      expect(result.processedContent).toContain('/guru-attachments/')
      expect(result.processedContent).toContain('https://example.com/failure.jpg') // unchanged
    })

    it('should handle timeout/network errors gracefully', async () => {
      const card = {
        content: '<img src="https://slow-server.com/image.jpg">'
      }

      downloadFile.mockRejectedValue(new Error('Request timeout'))

      await expect(processAttachments(card, {}, '/tmp/test')).resolves.toBeDefined()
    })

    it('should handle non-HTTP URLs', () => {
      const card = {
        content: `
          <img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==" />
          <img src="ftp://example.com/image.jpg" />
          <img src="/relative/path/image.jpg" />
        `
      }

      // Should not attempt to download non-HTTP URLs
      const result = processAttachments(card, {}, '/tmp/test')

      return result.then(res => {
        expect(downloadFile).not.toHaveBeenCalled()
        expect(res.attachedFiles).toHaveLength(0)
      })
    })

    it('should handle corrupted file URLs', async () => {
      const card = {
        content: '<img src="https://example.com/file with spaces.jpg">'
      }

      downloadFile.mockResolvedValue({
        buffer: Buffer.from('content'),
        contentType: 'image/jpeg'
      })

      const result = await processAttachments(card, {}, '/tmp/test')

      expect(downloadFile).toHaveBeenCalledWith(
        'https://example.com/file with spaces.jpg',
        {}
      )
    })

    it('should handle very large number of attachments', async () => {
      const images = Array(50).fill().map((_, i) => 
        `<img src="https://example.com/image${i}.jpg">`
      ).join('\n')

      const card = {
        content: images
      }

      downloadFile.mockResolvedValue({
        buffer: Buffer.from('image'),
        contentType: 'image/jpeg'
      })

      const result = await processAttachments(card, {}, '/tmp/test')

      expect(downloadFile).toHaveBeenCalledTimes(50)
      expect(result.attachedFiles).toHaveLength(50)
    })
  })

  describe('processCardContent - integration edge cases', () => {
    beforeEach(() => {
      downloadFile.mockClear()
    })

    it('should handle card with complex nested content', async () => {
      const card = {
        id: 'complex-card',
        content: `
          <h1>Complex Card</h1>
          <table>
            <tr><th>Header</th></tr>
            <tr><td>
              <img src="https://example.com/image.jpg">
              <a href="https://app.getguru.com/card/test" data-ghq-guru-card-id="other-card">Link</a>
            </td></tr>
          </table>
        `
      }
      
      const allCards = [
        card,
        { id: 'other-card', title: 'Other Card' }
      ]

      downloadFile.mockResolvedValue({
        buffer: Buffer.from('image'),
        contentType: 'image/jpeg'
      })

      const result = await processCardContent(
        card,
        allCards,
        true,
        '/tmp/test',
        {}
      )

      expect(result.markdownContent).toContain('# Complex Card')
      expect(result.markdownContent).toContain('| Header |')
      expect(result.markdownContent).toContain('/guru-attachments/')
      expect(result.markdownContent).toContain('/pages/other-card/')
      expect(result.attachedFiles).toHaveLength(1)
    })
  })

  describe('filterCardsByVerification - edge cases', () => {
    it('should handle mixed case verification states', () => {
      const cards = [
        { id: 'card-1', title: 'Card 1', verificationState: 'trusted' },
        { id: 'card-2', title: 'Card 2', verificationState: 'TRUSTED' },
        { id: 'card-3', title: 'Card 3', verificationState: 'Trusted' }
      ]

      const result = filterCardsByVerification(cards, true)

      // Should only match exact case
      expect(result).toHaveLength(1)
      expect(result[0].id).toBe('card-2')
    })

    it('should handle cards with undefined verification states', () => {
      const cards = [
        { id: 'card-1', title: 'Card 1' }, // undefined verificationState
        { id: 'card-2', title: 'Card 2', verificationState: null },
        { id: 'card-3', title: 'Card 3', verificationState: 'TRUSTED' }
      ]

      const result = filterCardsByVerification(cards, true)

      expect(result).toHaveLength(1)
      expect(result[0].id).toBe('card-3')
    })

    it('should handle very long card titles efficiently', () => {
      const longTitle = 'A very long title that repeats itself '.repeat(50)
      const cards = [
        { id: 'card-1', title: longTitle, verificationState: 'TRUSTED' },
        { id: 'card-2', title: longTitle, verificationState: 'NEEDS_VERIFICATION' }
      ]

      const result = filterCardsByVerification(cards, true)

      expect(result).toHaveLength(1)
      expect(result[0].id).toBe('card-1')
    })

    it('should handle special characters in titles for comparison', () => {
      const cards = [
        { id: 'card-1', title: 'Tëst Cård with Spëciål Châractérs', verificationState: 'TRUSTED' },
        { id: 'card-2', title: 'Tëst Cård with Spëciål Châractérs', verificationState: 'NEEDS_VERIFICATION' }
      ]

      const result = filterCardsByVerification(cards, true)

      expect(result).toHaveLength(1)
      expect(result[0].id).toBe('card-1')
    })
  })
})