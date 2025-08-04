const fetch = require('node-fetch')
const TurndownService = require('turndown')
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

// Function to convert internal Guru links to local links
const convertInternalLinks = (content, currentCard, allCards) => {
  if (!content || !allCards) return content
  
  let processedContent = content
  console.log(`Converting internal links for card: ${currentCard.title || currentCard.id}`)
  
  // Create a map of card IDs to titles for quick lookup
  const cardMap = new Map()
  allCards.forEach(card => {
    if (card.id) {
      cardMap.set(card.id, {
        title: card.preferredPhrase || card.title || card.id,
        slug: createSlugFromTitle(card.preferredPhrase || card.title || card.id)
      })
    }
  })
  
  // Match Guru card links with data-ghq-guru-card-id attributes
  const guruCardLinkRegex = /data-ghq-guru-card-id=["']([a-f0-9-]+)["']/gi
  const guruCardMatches = [...processedContent.matchAll(guruCardLinkRegex)]
  
  console.log(`Found ${guruCardMatches.length} Guru card links in content`)
  
  guruCardMatches.forEach(match => {
    const cardId = match[1]
    
    if (cardMap.has(cardId)) {
      const linkedCard = cardMap.get(cardId)
      const localPath = `/pages/${linkedCard.slug}/`
      
      console.log(`Converting Guru card link with ID ${cardId} -> ${localPath}`)
      
      // Use a simpler approach - just replace all instances of the Guru URL with the local path
      const guruUrlPattern = /https:\/\/app\.getguru\.com\/card\/[^"'\s>]+/gi
      const beforeReplace = processedContent.includes('https://app.getguru.com/card/')
      
      processedContent = processedContent.replace(guruUrlPattern, localPath)
      
      const afterReplace = processedContent.includes('https://app.getguru.com/card/')
      console.log(`URL replacement: before=${beforeReplace}, after=${afterReplace}`)
      
    } else {
      console.log(`Card not found in collection: ${cardId}`)
    }
  })
  
  // Also match traditional URL patterns as fallback
  const guruLinkPatterns = [
    // https://app.getguru.com/card/card-id
    /https:\/\/app\.getguru\.com\/card\/([a-f0-9-]+)/gi,
    // https://getguru.com/card/card-id  
    /https:\/\/getguru\.com\/card\/([a-f0-9-]+)/gi,
    // Internal Guru card references
    /guru:\/\/card\/([a-f0-9-]+)/gi
  ]
  
  guruLinkPatterns.forEach(pattern => {
    const matches = [...processedContent.matchAll(pattern)]
    matches.forEach(match => {
      const fullUrl = match[0]
      const cardId = match[1]
      
      if (cardMap.has(cardId)) {
        const linkedCard = cardMap.get(cardId)
        const localPath = `/pages/${linkedCard.slug}/`
        
        console.log(`Converting traditional link: ${fullUrl} -> ${localPath}`)
        
        // Replace the URL in href attributes
        processedContent = processedContent.replace(
          new RegExp(`href=["']${fullUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["']`, 'gi'),
          `href="${localPath}"`
        )
        
        // Replace standalone URLs
        processedContent = processedContent.replace(
          new RegExp(fullUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'),
          localPath
        )
      } else {
        console.log(`Card not found in collection: ${cardId}`)
      }
    })
  })
  
  return processedContent
}

// Helper function to create URL-safe slugs from titles
const createSlugFromTitle = (title) => {
  return title
    .toLowerCase()
    .replace(/[^\w\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-')     // Replace spaces with hyphens
    .replace(/-+/g, '-')      // Replace multiple hyphens with single
    .trim()
}

// Function to download and save files
const downloadFile = async (url, headers, downloadDir) => {
  try {
    console.log(`Downloading file from: ${url}`)
    
    // For Guru content URLs, ensure we have the right headers
    let requestHeaders = { ...headers }
    if (url.includes('content.api.getguru.com')) {
      // Make sure we're not requesting HTML
      requestHeaders['Accept'] = '*/*'
      // Remove any HTML-specific headers
      delete requestHeaders['Accept-Language']
    }
    
    const response = await fetch(url, { headers: requestHeaders })
    console.log(`Response status: ${response.status}, content-type: ${response.headers.get('content-type')}`)
    
    if (!response.ok) {
      console.warn(`Failed to download file from ${url}: ${response.status}`)
      return null
    }

    // Create filename from URL or generate one
    const urlPath = new URL(url).pathname
    let originalFilename = path.basename(urlPath) || 'attachment'
    let fileExtension = path.extname(originalFilename)
    
    // If no extension, try to get it from content-type
    if (!fileExtension) {
      const contentType = response.headers.get('content-type') || ''
      if (contentType.includes('image/jpeg')) fileExtension = '.jpg'
      else if (contentType.includes('image/png')) fileExtension = '.png'
      else if (contentType.includes('image/gif')) fileExtension = '.gif'
      else if (contentType.includes('image/svg')) fileExtension = '.svg'
      else if (contentType.includes('image/webp')) fileExtension = '.webp'
      else if (contentType.includes('application/pdf')) fileExtension = '.pdf'
    }
    
    const baseName = path.basename(originalFilename, path.extname(originalFilename)) || 'file'
    
    // Create unique filename to avoid conflicts
    const hash = crypto.createHash('md5').update(url).digest('hex').substring(0, 8)
    const filename = `${baseName}_${hash}${fileExtension}`
    const filepath = path.join(downloadDir, filename)

    // Ensure download directory exists
    if (!fs.existsSync(downloadDir)) {
      fs.mkdirSync(downloadDir, { recursive: true })
    }

    // Download and save file
    const buffer = await response.buffer()
    fs.writeFileSync(filepath, buffer)
    
    const contentType = response.headers.get('content-type') || 'application/octet-stream'
    console.log(`Downloaded file: ${filename} (${buffer.length} bytes, content-type: ${contentType})`)
    
    // Log first few bytes as hex for debugging
    const firstBytes = buffer.slice(0, 16).toString('hex')
    console.log(`File header (hex): ${firstBytes}`)
    
    // Check if it's actually an image by looking at file signature
    const isImage = buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF // JPEG
                 || (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) // PNG
                 || (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46) // GIF
                 || (buffer.toString('utf8', 0, 5) === '<?xml' || buffer.toString('utf8', 0, 4) === '<svg') // SVG
    
    console.log(`File appears to be an image: ${isImage}`)
    
    return {
      filename,
      filepath,
      originalUrl: url,
      size: buffer.length,
      mimeType: contentType
    }
  } catch (error) {
    console.warn(`Error downloading file from ${url}:`, error.message)
    return null
  }
}

exports.sourceNodes = async (
  { actions, createNodeId, createContentDigest },
  pluginOptions
) => {
  const { createNode } = actions
  const { 
    apiUsername, 
    apiPassword, 
    teamName,
    authMode = 'user', // 'user' or 'collection'
    collectionId,
    collectionToken,
    downloadAttachments = false, // Enable file downloads
    attachmentDir = 'static/guru-attachments' // Directory to save files
  } = pluginOptions

  // Validate based on auth mode
  if (authMode === 'collection') {
    if (!collectionId || !collectionToken) {
      throw new Error('gatsby-source-guru in collection mode requires collectionId and collectionToken options')
    }
  } else {
    if (!apiUsername || !apiPassword || !teamName) {
      throw new Error('gatsby-source-guru in user mode requires apiUsername, apiPassword, and teamName options')
    }
  }

  // Set up authentication based on mode
  let authString, headers;
  if (authMode === 'collection') {
    authString = Buffer.from(`${collectionId}:${collectionToken}`).toString('base64')
  } else {
    authString = Buffer.from(`${apiUsername}:${apiPassword}`).toString('base64')
  }
  
  headers = {
    'Authorization': `Basic ${authString}`,
    'Accept': 'application/json'
  }

  // Initialize turndown service for HTML to markdown conversion
  const turndownService = new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced'
  })

  console.log('Guru Plugin: Starting data fetch...')
  console.log('Auth mode:', authMode)
  console.log('Collection ID:', collectionId ? collectionId.substring(0, 8) + '...' : 'Not set')
  console.log('Auth header:', `Basic ${authString.substring(0, 20)}...`)
  
  try {
    if (authMode === 'collection') {
      // Collection auth mode - use search API to fetch cards
      console.log('Using search API for collection auth mode')
      
      // Search for all cards - empty query returns all accessible cards
      const searchUrl = `https://api.getguru.com/api/v1/search/query?q=`
      console.log('Search URL:', searchUrl)
      
      const searchResponse = await fetch(searchUrl, { headers })

      if (!searchResponse.ok) {
        const errorBody = await searchResponse.text()
        console.error('Response status:', searchResponse.status)
        console.error('Response headers:', searchResponse.headers)
        console.error('Error body:', errorBody)
        throw new Error(`Failed to fetch cards via search: ${searchResponse.status} ${searchResponse.statusText} - ${errorBody}`)
      }

      const searchResults = await searchResponse.json()
      console.log(`Found ${searchResults.length || 0} cards via search`)
      
      // Log the first card to see its structure
      if (searchResults.length > 0) {
        console.log('Sample card structure:', JSON.stringify(searchResults[0], null, 2))
      }

      // Create nodes for each card
      if (Array.isArray(searchResults)) {
        for (const card of searchResults) {
          let processedContent = card.content || ''
          let attachedFiles = []
          let downloadedImages = []
          
          // Download attachments and images if enabled
          if (downloadAttachments && card.content) {
            console.log(`Processing attachments for card: ${card.title || card.id}`)
            
            // Extract image URLs from HTML content
            const imageUrlRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi
            const imageMatches = [...card.content.matchAll(imageUrlRegex)]
            const imageUrls = imageMatches.map(match => match[1])
            
            // Download images and update HTML content to reference local files
            for (const imageUrl of imageUrls) {
              if (imageUrl.startsWith('http')) {
                // For Guru content URLs, test if they're publicly accessible
                if (imageUrl.includes('content.api.getguru.com/files/view/')) {
                  console.log(`Testing if Guru file is public: ${imageUrl}`)
                  
                  // First, test without authentication to see if it's public
                  const testResponse = await fetch(imageUrl, { 
                    headers: { 'Accept': '*/*' }
                    // Use GET request since HEAD might not be supported
                  })
                  
                  console.log(`Public test - Status: ${testResponse.status}, Content-Type: ${testResponse.headers.get('content-type')}`)
                  
                  // If it's public and returns actual file content (not HTML)
                  if (testResponse.ok && testResponse.headers.get('content-type') !== 'text/html') {
                    console.log(`File is public, downloading: ${imageUrl}`)
                    const downloadedImage = await downloadFile(imageUrl, {}, attachmentDir)
                    if (downloadedImage) {
                      downloadedImages.push(downloadedImage)
                      
                      // Replace the image URL in HTML content with local path
                      const localPath = `/guru-attachments/${downloadedImage.filename}`
                      processedContent = processedContent.replace(new RegExp(imageUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), localPath)
                    }
                  } else {
                    console.log(`File is not public or returns HTML, keeping original URL: ${imageUrl}`)
                    // Keep the original URL - no replacement needed
                  }
                } else {
                  // For non-Guru URLs, download normally
                  const downloadedImage = await downloadFile(imageUrl, headers, attachmentDir)
                  if (downloadedImage) {
                    downloadedImages.push(downloadedImage)
                    
                    // Replace the image URL in HTML content with local path
                    const localPath = `/guru-attachments/${downloadedImage.filename}`
                    processedContent = processedContent.replace(new RegExp(imageUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), localPath)
                  }
                }
              }
            }
            
            // Extract other file URLs from HTML content
            const fileUrlRegex = /https:\/\/[^"\s<>]+\.(pdf|doc|docx|xls|xlsx|ppt|pptx|zip|txt|csv)/gi
            const fileUrls = processedContent.match(fileUrlRegex) || []
            
            // Also check for Guru attachment URLs
            const guruAttachmentRegex = /https:\/\/api\.getguru\.com\/api\/v1\/cards\/[^"]+\/attachments\/[^"\s<>]+/gi
            const guruFileUrls = processedContent.match(guruAttachmentRegex) || []
            
            const allFileUrls = [...new Set([...fileUrls, ...guruFileUrls])]
            
            if (allFileUrls.length > 0) {
              console.log(`Found ${allFileUrls.length} non-image attachment(s) in card`)
              
              for (const fileUrl of allFileUrls) {
                const downloadedFile = await downloadFile(fileUrl, headers, attachmentDir)
                if (downloadedFile) {
                  attachedFiles.push(downloadedFile)
                }
              }
            }
            
            // Combine all downloaded files
            attachedFiles = [...attachedFiles, ...downloadedImages]
            
            if (attachedFiles.length > 0) {
              console.log(`Downloaded ${attachedFiles.length} file(s) total`)
            }
          }
          
          // Convert internal Guru links to local links
          processedContent = convertInternalLinks(processedContent, card, searchResults || cards)
          
          // Convert processed HTML content to markdown
          const markdownContent = processedContent ? turndownService.turndown(processedContent) : ''
          
          // Create a copy of card data without the original title field
          const { title: originalTitle, ...cardWithoutTitle } = card
          
          const nodeData = {
            ...cardWithoutTitle,
            // Set title field to preferredPhrase
            title: card.preferredPhrase || originalTitle || 'Untitled Card',
            content: markdownContent, // Markdown with local image references
            contentHtml: card.content, // Keep original HTML as well
            attachedFiles, // Array of downloaded files including images
            slug: createSlugFromTitle(card.preferredPhrase || originalTitle || card.id), // URL-safe slug
            // Handle owner and lastModifiedBy fields that might be objects
            owner: typeof card.owner === 'object' ? `${card.owner?.firstName || ''} ${card.owner?.lastName || ''}`.trim() || 'Unknown' : card.owner || 'Unknown',
            lastModifiedBy: typeof card.lastModifiedBy === 'object' ? `${card.lastModifiedBy?.firstName || ''} ${card.lastModifiedBy?.lastName || ''}`.trim() || 'Unknown' : card.lastModifiedBy || 'Unknown',
            id: createNodeId(`guru-card-${card.id}`),
            parent: null,
            children: [],
            internal: {
              type: 'GuruCard',
              content: JSON.stringify({...card, content: markdownContent, attachedFiles}),
              contentDigest: createContentDigest({...card, content: markdownContent, attachedFiles})
            }
          }
          createNode(nodeData)
        }
      }

    } else {
      // User auth mode - fetch from team endpoints
      const cardsResponse = await fetch(
        `https://api.getguru.com/api/v1/teams/${teamName}/cards`,
        { headers }
      )

      if (!cardsResponse.ok) {
        throw new Error(`Failed to fetch cards: ${cardsResponse.status} ${cardsResponse.statusText}`)
      }

      const cards = await cardsResponse.json()

      // Create nodes for each card
      for (const card of cards) {
        let processedContent = card.content || ''
        let attachedFiles = []
        let downloadedImages = []
        
        // Download attachments and images if enabled
        if (downloadAttachments && card.content) {
          console.log(`Processing attachments for card: ${card.title || card.id}`)
          
          // Extract image URLs from HTML content
          const imageUrlRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi
          const imageMatches = [...card.content.matchAll(imageUrlRegex)]
          const imageUrls = imageMatches.map(match => match[1])
          
          // Download images and update HTML content to reference local files
          for (const imageUrl of imageUrls) {
            if (imageUrl.startsWith('http')) {
              // For Guru content URLs, test if they're publicly accessible
              if (imageUrl.includes('content.api.getguru.com/files/view/')) {
                console.log(`Testing if Guru file is public: ${imageUrl}`)
                
                // First, test without authentication to see if it's public
                const testResponse = await fetch(imageUrl, { 
                  headers: { 'Accept': '*/*' }
                  // Use GET request since HEAD might not be supported
                })
                
                console.log(`Public test - Status: ${testResponse.status}, Content-Type: ${testResponse.headers.get('content-type')}`)
                
                // If it's public and returns actual file content (not HTML)
                if (testResponse.ok && testResponse.headers.get('content-type') !== 'text/html') {
                  console.log(`File is public, downloading: ${imageUrl}`)
                  const downloadedImage = await downloadFile(imageUrl, {}, attachmentDir)
                  if (downloadedImage) {
                    downloadedImages.push(downloadedImage)
                    
                    // Replace the image URL in HTML content with local path
                    const localPath = `/guru-attachments/${downloadedImage.filename}`
                    processedContent = processedContent.replace(new RegExp(imageUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), localPath)
                  }
                } else {
                  console.log(`File is not public or returns HTML, keeping original URL: ${imageUrl}`)
                  // Keep the original URL - no replacement needed
                }
              } else {
                // For non-Guru URLs, download normally
                const downloadedImage = await downloadFile(imageUrl, headers, attachmentDir)
                if (downloadedImage) {
                  downloadedImages.push(downloadedImage)
                  
                  // Replace the image URL in HTML content with local path
                  const localPath = `/guru-attachments/${downloadedImage.filename}`
                  processedContent = processedContent.replace(new RegExp(imageUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), localPath)
                }
              }
            }
          }
          
          // Extract other file URLs from HTML content
          const fileUrlRegex = /https:\/\/[^"\s<>]+\.(pdf|doc|docx|xls|xlsx|ppt|pptx|zip|txt|csv)/gi
          const fileUrls = processedContent.match(fileUrlRegex) || []
          
          // Also check for Guru attachment URLs
          const guruAttachmentRegex = /https:\/\/api\.getguru\.com\/api\/v1\/cards\/[^"]+\/attachments\/[^"\s<>]+/gi
          const guruFileUrls = processedContent.match(guruAttachmentRegex) || []
          
          const allFileUrls = [...new Set([...fileUrls, ...guruFileUrls])]
          
          if (allFileUrls.length > 0) {
            console.log(`Found ${allFileUrls.length} non-image attachment(s) in card`)
            
            for (const fileUrl of allFileUrls) {
              const downloadedFile = await downloadFile(fileUrl, headers, attachmentDir)
              if (downloadedFile) {
                attachedFiles.push(downloadedFile)
              }
            }
          }
          
          // Combine all downloaded files
          attachedFiles = [...attachedFiles, ...downloadedImages]
          
          if (attachedFiles.length > 0) {
            console.log(`Downloaded ${attachedFiles.length} file(s) total`)
          }
        }
        
        // Convert internal Guru links to local links
        processedContent = convertInternalLinks(processedContent, card, cards)
        
        // Convert processed HTML content to markdown
        const markdownContent = processedContent ? turndownService.turndown(processedContent) : ''
        
        // Create a copy of card data without the original title field
        const { title: originalTitle, ...cardWithoutTitle } = card
        
        const nodeData = {
          ...cardWithoutTitle,
          // Set title field to preferredPhrase
          title: card.preferredPhrase || originalTitle || 'Untitled Card',
          content: markdownContent, // Markdown with local image references
          contentHtml: card.content, // Keep original HTML as well
          attachedFiles, // Array of downloaded files including images
          slug: createSlugFromTitle(card.preferredPhrase || originalTitle || card.id), // URL-safe slug
          // Handle owner and lastModifiedBy fields that might be objects
          owner: typeof card.owner === 'object' ? `${card.owner?.firstName || ''} ${card.owner?.lastName || ''}`.trim() || 'Unknown' : card.owner || 'Unknown',
          lastModifiedBy: typeof card.lastModifiedBy === 'object' ? `${card.lastModifiedBy?.firstName || ''} ${card.lastModifiedBy?.lastName || ''}`.trim() || 'Unknown' : card.lastModifiedBy || 'Unknown',
          id: createNodeId(`guru-card-${card.id}`),
          parent: null,
          children: [],
          internal: {
            type: 'GuruCard',
            content: JSON.stringify({...card, content: markdownContent, attachedFiles}),
            contentDigest: createContentDigest({...card, content: markdownContent, attachedFiles})
          }
        }

        createNode(nodeData)
      }

      // Optionally fetch collections
      if (pluginOptions.fetchCollections) {
        const collectionsResponse = await fetch(
          `https://api.getguru.com/api/v1/teams/${teamName}/collections`,
          { headers }
        )

        if (collectionsResponse.ok) {
          const collections = await collectionsResponse.json()

          collections.forEach(collection => {
            const nodeData = {
              ...collection,
              id: createNodeId(`guru-collection-${collection.id}`),
              parent: null,
              children: [],
              internal: {
                type: 'GuruCollection',
                content: JSON.stringify(collection),
                contentDigest: createContentDigest(collection)
              }
            }

            createNode(nodeData)
          })
        }
      }

      // Optionally fetch boards
      if (pluginOptions.fetchBoards) {
        const boardsResponse = await fetch(
          `https://api.getguru.com/api/v1/teams/${teamName}/boards`,
          { headers }
        )

        if (boardsResponse.ok) {
          const boards = await boardsResponse.json()

          boards.forEach(board => {
            const nodeData = {
              ...board,
              id: createNodeId(`guru-board-${board.id}`),
              parent: null,
              children: [],
              internal: {
                type: 'GuruBoard',
                content: JSON.stringify(board),
                contentDigest: createContentDigest(board)
              }
            }

            createNode(nodeData)
          })
        }
      }
    }

  } catch (error) {
    console.error('Error fetching Guru data:', error)
    throw error
  }
}

exports.createSchemaCustomization = ({ actions }) => {
  const { createTypes } = actions

  const typeDefs = `
    type GuruCard implements Node {
      id: ID!
      content: String
      contentHtml: String
      title: String
      collection: GuruCollection
      collectionId: String
      boards: [GuruBoard]
      boardIds: [String]
      owner: String
      lastModified: String
      lastModifiedBy: String
      dateCreated: String
      verificationState: String
      verificationInterval: Int
      shareStatus: String
      tags: [String]
      slug: String!
      attachedFiles: [GuruAttachment]
    }
    
    type GuruBoard {
      id: String!
      title: String!
      slug: String
      items: [String]
      numberOfFacts: Int
    }
    
    type GuruCollection {
      id: String!
      name: String!
      color: String
      collectionType: String
      publicCardsEnabled: Boolean
      collectionTypeDetail: String
    }

    type GuruAttachment {
      filename: String!
      filepath: String!
      originalUrl: String!
      size: Int!
      mimeType: String!
    }

    type GuruCollection implements Node {
      id: ID!
      name: String
      description: String
      colour: String
      publicCardsEnabled: Boolean
      dateCreated: String
      stats: GuruCollectionStats
    }

    type GuruCollectionStats {
      cards: Int
      boards: Int
      boardSections: Int
    }

    type GuruBoard implements Node {
      id: ID!
      title: String
      description: String
      collection: String
      collectionId: String
      dateCreated: String
      lastModified: String
      owner: String
    }
  `

  createTypes(typeDefs)
}