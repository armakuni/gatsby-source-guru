// Utility functions for gatsby-source-guru
const crypto = require('crypto')
const fs = require('fs')
const path = require('path')

// Configuration constants
const FILE_EXTENSIONS = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'zip', 'txt', 'csv']
const IMAGE_SIGNATURES = {
  JPEG: [0xFF, 0xD8, 0xFF],
  PNG: [0x89, 0x50, 0x4E, 0x47],
  GIF: [0x47, 0x49, 0x46]
}
const CONTENT_TYPE_EXTENSIONS = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
  'image/svg': '.svg',
  'image/webp': '.webp',
  'application/pdf': '.pdf'
}

// Regex patterns for Guru links
const GURU_LINK_PATTERNS = [
  /data-ghq-guru-card-id=["']([a-f0-9-]+)["']/gi,
  /https:\/\/app\.getguru\.com\/card\/([a-f0-9-]+)/gi,
  /https:\/\/getguru\.com\/card\/([a-f0-9-]+)/gi,
  /guru:\/\/card\/([a-f0-9-]+)/gi
]

// Helper function to create URL-safe slugs from titles
const createSlugFromTitle = (title) => {
  return title
    .toLowerCase()
    .replace(/[^\w\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-')     // Replace spaces with hyphens
    .replace(/-+/g, '-')      // Replace multiple hyphens with single
    .trim()
}

// Utility functions
const getFileExtensionFromContentType = (contentType) => {
  return CONTENT_TYPE_EXTENSIONS[contentType] || ''
}

const isImageBySignature = (buffer) => {
  return (buffer[0] === IMAGE_SIGNATURES.JPEG[0] && buffer[1] === IMAGE_SIGNATURES.JPEG[1] && buffer[2] === IMAGE_SIGNATURES.JPEG[2]) ||
         (buffer[0] === IMAGE_SIGNATURES.PNG[0] && buffer[1] === IMAGE_SIGNATURES.PNG[1] && buffer[2] === IMAGE_SIGNATURES.PNG[2] && buffer[3] === IMAGE_SIGNATURES.PNG[3]) ||
         (buffer[0] === IMAGE_SIGNATURES.GIF[0] && buffer[1] === IMAGE_SIGNATURES.GIF[1] && buffer[2] === IMAGE_SIGNATURES.GIF[2]) ||
         (buffer.toString('utf8', 0, 5) === '<?xml' || buffer.toString('utf8', 0, 4) === '<svg')
}

const ensureDirectoryExists = (dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
}

// Extract all file URLs from content
const extractFileUrls = (content) => {
  const imageUrlRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi
  const imageUrls = [...content.matchAll(imageUrlRegex)].map(match => match[1])
  
  const fileUrlRegex = new RegExp(`https:\\/\\/[^"\\s<>]+\\.(${FILE_EXTENSIONS.join('|')})`, 'gi')
  const fileUrls = content.match(fileUrlRegex) || []
  
  const guruAttachmentRegex = /https:\/\/api\.getguru\.com\/api\/v1\/cards\/[^"]+\/attachments\/[^"\s<>]+/gi
  const guruFileUrls = content.match(guruAttachmentRegex) || []
  
  return {
    imageUrls,
    otherFileUrls: [...new Set([...fileUrls, ...guruFileUrls])]
  }
}

// Helper function to format user names
const formatUserName = (user) => {
  if (typeof user === 'object' && user) {
    return `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Unknown'
  }
  return user || 'Unknown'
}

// Validate plugin options
const validateOptions = (pluginOptions) => {
  const { authMode = 'user', collectionId, collectionToken, apiUsername, apiPassword, teamName } = pluginOptions
  
  if (authMode === 'collection') {
    if (!collectionId || !collectionToken) {
      throw new Error('gatsby-source-guru in collection mode requires collectionId and collectionToken options')
    }
  } else {
    if (!apiUsername || !apiPassword || !teamName) {
      throw new Error('gatsby-source-guru in user mode requires apiUsername, apiPassword, and teamName options')
    }
  }
}

// Create authentication headers
const createAuthHeaders = (pluginOptions) => {
  const { authMode = 'user', collectionId, collectionToken, apiUsername, apiPassword } = pluginOptions
  
  let authString
  if (authMode === 'collection') {
    authString = Buffer.from(`${collectionId}:${collectionToken}`).toString('base64')
  } else {
    authString = Buffer.from(`${apiUsername}:${apiPassword}`).toString('base64')
  }
  
  return {
    'Authorization': `Basic ${authString}`,
    'Accept': 'application/json'
  }
}

module.exports = {
  FILE_EXTENSIONS,
  IMAGE_SIGNATURES,
  CONTENT_TYPE_EXTENSIONS,
  GURU_LINK_PATTERNS,
  createSlugFromTitle,
  getFileExtensionFromContentType,
  isImageBySignature,
  ensureDirectoryExists,
  extractFileUrls,
  formatUserName,
  validateOptions,
  createAuthHeaders
}