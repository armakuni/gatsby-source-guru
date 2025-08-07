/**
 * @jest-environment node
 */

const { createSchemaCustomization } = require('../gatsby-node')
const {
  createSlugFromTitle,
  getFileExtensionFromContentType,
  isImageBySignature,
  extractFileUrls,
  formatUserName,
  validateOptions,
  createAuthHeaders,
  ensureDirectoryExists
} = require('../utils')
const fs = require('fs')
const path = require('path')

describe('gatsby-source-guru basic tests', () => {
  describe('Schema Creation', () => {
    it('should create GraphQL schema', () => {
      const mockActions = {
        createTypes: jest.fn()
      }
      
      createSchemaCustomization({ actions: mockActions })
      
      expect(mockActions.createTypes).toHaveBeenCalled()
      const schemaCall = mockActions.createTypes.mock.calls[0][0]
      expect(schemaCall).toContain('type GuruCard implements Node')
    })
  })

  describe('Utility Functions', () => {
    describe('createSlugFromTitle', () => {
      it('should create URL-friendly slugs', () => {
        expect(createSlugFromTitle('Test Card Title')).toBe('test-card-title')
        expect(createSlugFromTitle('API Guide')).toBe('api-guide')
        expect(createSlugFromTitle('Special!@#$%^&*()Characters')).toBe('specialcharacters')
        expect(createSlugFromTitle('Multiple   Spaces')).toBe('multiple-spaces')
        expect(createSlugFromTitle('Trimmed Title ')).toBe('trimmed-title')
      })
    })

    describe('getFileExtensionFromContentType', () => {
      it('should return correct file extensions for content types', () => {
        expect(getFileExtensionFromContentType('image/jpeg')).toBe('.jpg')
        expect(getFileExtensionFromContentType('image/png')).toBe('.png')
        expect(getFileExtensionFromContentType('image/gif')).toBe('.gif')
        expect(getFileExtensionFromContentType('application/pdf')).toBe('.pdf')
        expect(getFileExtensionFromContentType('unknown/type')).toBe('')
      })
    })

    describe('isImageBySignature', () => {
      it('should detect JPEG images', () => {
        const jpegBuffer = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0])
        expect(isImageBySignature(jpegBuffer)).toBe(true)
      })

      it('should detect PNG images', () => {
        const pngBuffer = Buffer.from([0x89, 0x50, 0x4E, 0x47])
        expect(isImageBySignature(pngBuffer)).toBe(true)
      })

      it('should detect GIF images', () => {
        const gifBuffer = Buffer.from([0x47, 0x49, 0x46])
        expect(isImageBySignature(gifBuffer)).toBe(true)
      })

      it('should detect SVG images', () => {
        const svgBuffer = Buffer.from('<?xml version="1.0"?><svg>')
        expect(isImageBySignature(svgBuffer)).toBe(true)
      })

      it('should return false for non-image data', () => {
        const textBuffer = Buffer.from('Hello World')
        expect(isImageBySignature(textBuffer)).toBe(false)
      })
    })

    describe('extractFileUrls', () => {
      it('should extract image URLs from content', () => {
        const content = '<img src="https://example.com/image.jpg" alt="test">'
        const result = extractFileUrls(content)
        expect(result.imageUrls).toContain('https://example.com/image.jpg')
      })

      it('should extract file URLs from content', () => {
        const content = 'Download the file: https://example.com/document.pdf'
        const result = extractFileUrls(content)
        expect(result.otherFileUrls).toContain('https://example.com/document.pdf')
      })

      it('should extract Guru attachment URLs', () => {
        const content = 'https://api.getguru.com/api/v1/cards/123/attachments/456'
        const result = extractFileUrls(content)
        expect(result.otherFileUrls).toContain('https://api.getguru.com/api/v1/cards/123/attachments/456')
      })
    })

    describe('formatUserName', () => {
      it('should format user object with first and last name', () => {
        const user = { firstName: 'John', lastName: 'Doe' }
        expect(formatUserName(user)).toBe('John Doe')
      })

      it('should format user object with only first name', () => {
        const user = { firstName: 'John' }
        expect(formatUserName(user)).toBe('John')
      })

      it('should format user object with only last name', () => {
        const user = { lastName: 'Doe' }
        expect(formatUserName(user)).toBe('Doe')
      })

      it('should return Unknown for empty user object', () => {
        const user = {}
        expect(formatUserName(user)).toBe('Unknown')
      })

      it('should return string directly if user is a string', () => {
        expect(formatUserName('John Doe')).toBe('John Doe')
      })

      it('should return Unknown for null or undefined', () => {
        expect(formatUserName(null)).toBe('Unknown')
        expect(formatUserName(undefined)).toBe('Unknown')
      })
    })

    describe('validateOptions', () => {
      it('should validate collection mode options', () => {
        const validOptions = {
          authMode: 'collection',
          collectionId: 'test-id',
          collectionToken: 'test-token'
        }
        expect(() => validateOptions(validOptions)).not.toThrow()
      })

      it('should validate user mode options', () => {
        const validOptions = {
          authMode: 'user',
          apiUsername: 'testuser',
          apiPassword: 'testpass',
          teamName: 'testteam'
        }
        expect(() => validateOptions(validOptions)).not.toThrow()
      })

      it('should throw error for invalid collection mode options', () => {
        const invalidOptions = {
          authMode: 'collection',
          collectionId: 'test-id'
          // Missing collectionToken
        }
        expect(() => validateOptions(invalidOptions)).toThrow('collection mode requires collectionId and collectionToken')
      })

      it('should throw error for invalid user mode options', () => {
        const invalidOptions = {
          authMode: 'user',
          apiUsername: 'testuser'
          // Missing apiPassword and teamName
        }
        expect(() => validateOptions(invalidOptions)).toThrow('user mode requires apiUsername, apiPassword, and teamName')
      })
    })

    describe('createAuthHeaders', () => {
      it('should create auth headers for collection mode', () => {
        const options = {
          authMode: 'collection',
          collectionId: 'test-id',
          collectionToken: 'test-token'
        }
        const headers = createAuthHeaders(options)
        expect(headers.Authorization).toBe('Basic dGVzdC1pZDp0ZXN0LXRva2Vu')
        expect(headers.Accept).toBe('application/json')
      })

      it('should create auth headers for user mode', () => {
        const options = {
          authMode: 'user',
          apiUsername: 'testuser',
          apiPassword: 'testpass'
        }
        const headers = createAuthHeaders(options)
        expect(headers.Authorization).toBe('Basic dGVzdHVzZXI6dGVzdHBhc3M=')
        expect(headers.Accept).toBe('application/json')
      })

      it('should default to user mode if not specified', () => {
        const options = {
          apiUsername: 'testuser',
          apiPassword: 'testpass'
        }
        const headers = createAuthHeaders(options)
        expect(headers.Authorization).toBe('Basic dGVzdHVzZXI6dGVzdHBhc3M=')
      })
    })

    describe('ensureDirectoryExists', () => {
      const testDir = path.join(__dirname, 'test-temp-dir')

      afterEach(() => {
        // Clean up test directory after each test
        if (fs.existsSync(testDir)) {
          fs.rmSync(testDir, { recursive: true, force: true })
        }
      })

      it('should create directory if it does not exist', () => {
        expect(fs.existsSync(testDir)).toBe(false)
        ensureDirectoryExists(testDir)
        expect(fs.existsSync(testDir)).toBe(true)
      })

      it('should not error if directory already exists', () => {
        fs.mkdirSync(testDir)
        expect(fs.existsSync(testDir)).toBe(true)
        expect(() => ensureDirectoryExists(testDir)).not.toThrow()
        expect(fs.existsSync(testDir)).toBe(true)
      })

      it('should create nested directories', () => {
        const nestedDir = path.join(testDir, 'nested', 'path')
        expect(fs.existsSync(nestedDir)).toBe(false)
        ensureDirectoryExists(nestedDir)
        expect(fs.existsSync(nestedDir)).toBe(true)
      })
    })
  })

  describe('Content processing', () => {
    it('should process HTML with turndown', () => {
      const TurndownService = require('turndown')
      const turndown = new TurndownService()
      
      const html = '<h1>Title</h1><p>Content</p>'
      const markdown = turndown.turndown(html)
      
      expect(markdown).toContain('Title')
      expect(markdown).toContain('Content')
      expect(markdown).not.toContain('<h1>')
    })
  })
})