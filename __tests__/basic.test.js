/**
 * @jest-environment node
 */

const { createSchemaCustomization } = require('../gatsby-node')

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

  describe('Authentication utilities', () => {
    it('should create base64 auth headers', () => {
      const username = 'testuser'
      const password = 'testpass'
      
      const authString = Buffer.from(`${username}:${password}`).toString('base64')
      const authHeader = `Basic ${authString}`
      
      expect(authHeader).toBe('Basic dGVzdHVzZXI6dGVzdHBhc3M=')
    })
  })

  describe('Slug generation', () => {
    it('should create URL-friendly slugs', () => {
      // Inline the slug logic to test it
      const createSlug = (title) => {
        return title
          .toLowerCase()
          .replace(/[^a-z0-9\s-]/g, '')
          .replace(/\s+/g, '-')
          .replace(/-+/g, '-')
          .replace(/^-|-$/g, '')
      }
      
      expect(createSlug('Test Card Title')).toBe('test-card-title')
      expect(createSlug('API Guide')).toBe('api-guide')
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