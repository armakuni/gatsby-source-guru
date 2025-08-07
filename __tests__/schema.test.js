/**
 * @jest-environment node
 */

const { typeDefs } = require('../schema')

describe('schema', () => {
  describe('typeDefs', () => {
    it('should contain GuruCard type definition', () => {
      expect(typeDefs).toContain('type GuruCard implements Node')
    })

    it('should contain GuruCollection type definition', () => {
      expect(typeDefs).toContain('type GuruCollection implements Node')
    })

    it('should contain GuruBoard type definition', () => {
      expect(typeDefs).toContain('type GuruBoard implements Node')
    })

    it('should contain GuruAttachment type definition', () => {
      expect(typeDefs).toContain('type GuruAttachment')
    })

    it('should contain GuruUser type definition', () => {
      expect(typeDefs).toContain('type GuruUser')
    })

    it('should contain GuruBoardInfo type definition', () => {
      expect(typeDefs).toContain('type GuruBoardInfo')
    })

    it('should define required fields for GuruCard', () => {
      expect(typeDefs).toContain('id: ID!')
      expect(typeDefs).toContain('title: String!')
      expect(typeDefs).toContain('content: String')
      expect(typeDefs).toContain('contentHtml: String')
      expect(typeDefs).toContain('slug: String!')
    })

    it('should define date fields for GuruCard', () => {
      expect(typeDefs).toContain('dateCreated: Date')
      expect(typeDefs).toContain('lastModified: Date')
      expect(typeDefs).toContain('lastVerified: Date')
      expect(typeDefs).toContain('nextVerificationDate: Date')
    })

    it('should define user fields for GuruCard', () => {
      expect(typeDefs).toContain('owner: String')
      expect(typeDefs).toContain('lastModifiedBy: String')
      expect(typeDefs).toContain('lastVerifiedBy: String')
    })

    it('should define verification fields for GuruCard', () => {
      expect(typeDefs).toContain('verificationState: String')
      expect(typeDefs).toContain('verificationInterval: Int')
      expect(typeDefs).toContain('verificationType: String')
    })

    it('should define relationship fields for GuruCard', () => {
      expect(typeDefs).toContain('boards: [GuruBoardInfo]')
      expect(typeDefs).toContain('collection: GuruCollection')
      expect(typeDefs).toContain('attachedFiles: [GuruAttachment]')
    })

    it('should define GuruAttachment fields', () => {
      expect(typeDefs).toContain('filename: String!')
      expect(typeDefs).toContain('filepath: String!')
      expect(typeDefs).toContain('originalUrl: String!')
      expect(typeDefs).toContain('size: Int')
      expect(typeDefs).toContain('mimeType: String')
    })

    it('should define GuruCollection fields', () => {
      expect(typeDefs).toContain('name: String!')
      expect(typeDefs).toContain('color: String')
      expect(typeDefs).toContain('collectionType: String')
    })

    it('should define GuruBoard fields', () => {
      expect(typeDefs).toContain('title: String!')
      expect(typeDefs).toContain('parentFolder: GuruBoard')
    })

    it('should define GuruBoardInfo fields', () => {
      expect(typeDefs).toContain('title: String!')
      expect(typeDefs).toContain('parentFolder: GuruParentFolder')
    })

    it('should be valid GraphQL SDL', () => {
      // Test that the schema doesn't contain syntax errors by checking for balanced braces
      const openBraces = (typeDefs.match(/{/g) || []).length
      const closeBraces = (typeDefs.match(/}/g) || []).length
      expect(openBraces).toBe(closeBraces)

      // Check for proper type declarations
      expect(typeDefs).toMatch(/type \w+ (implements Node )?{/)
      
      // Check that all types are properly closed
      expect(typeDefs).not.toContain('}{')
    })

    it('should export typeDefs as a string', () => {
      expect(typeof typeDefs).toBe('string')
      expect(typeDefs.length).toBeGreaterThan(0)
    })

    it('should not contain template literals or dynamic content', () => {
      expect(typeDefs).not.toContain('${')
      expect(typeDefs).not.toContain('`')
    })
  })
})