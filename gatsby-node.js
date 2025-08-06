const fetch = require('node-fetch')
const TurndownService = require('turndown')
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const { typeDefs } = require('./schema')
const {
  GURU_LINK_PATTERNS,
  createSlugFromTitle,
  getFileExtensionFromContentType,
  isImageBySignature,
  ensureDirectoryExists,
  extractFileUrls,
  formatUserName,
  validateOptions,
  createAuthHeaders
} = require('./utils')

// Configuration constants
const GURU_API_BASE = 'https://api.getguru.com/api/v1'
const GURU_SEARCH_BASE = 'https://api.getguru.com/api/v1/search/query'

// Create card map for link conversion
const createCardMap = (allCards) => {
  const cardMap = new Map()
  allCards.forEach(card => {
    if (card.id) {
      cardMap.set(card.id, `/pages/${createSlugFromTitle(card.preferredPhrase || card.title || card.id)}/`)
    }
  })
  return cardMap
}

// Function to convert internal Guru links to local links
const convertInternalLinks = (content, currentCard, allCards) => {
  if (!content || !allCards) {
    console.log(`convertInternalLinks: missing content or allCards - content: ${!!content}, allCards: ${!!allCards}`)
    return content
  }
  
  const cardMap = createCardMap(allCards)
  let processedContent = content
  let linksFound = 0
  
  // Find complete anchor tags with Guru URLs and data-ghq-guru-card-id attributes
  const anchorTagRegex = /<a[^>]+href=["']https:\/\/(app\.)?getguru\.com\/card\/[^"']*["'][^>]*data-ghq-guru-card-id=["']([a-f0-9-]+)["'][^>]*>/gi
  
  const anchorMatches = [...processedContent.matchAll(anchorTagRegex)]
  
  anchorMatches.forEach(match => {
    const fullAnchorTag = match[0]
    const cardId = match[2] // The card ID from data-ghq-guru-card-id
    
    if (cardMap.has(cardId)) {
      const localPath = cardMap.get(cardId)
      
      // Replace the href in the anchor tag
      const updatedAnchorTag = fullAnchorTag.replace(
        /href=["']https:\/\/(app\.)?getguru\.com\/card\/[^"']*["']/i,
        `href="${localPath}"`
      )
      
      processedContent = processedContent.replace(fullAnchorTag, updatedAnchorTag)
      linksFound++
    }
  })
  
  // Also process the original patterns for backward compatibility
  GURU_LINK_PATTERNS.forEach(pattern => {
    const matches = [...processedContent.matchAll(pattern)]
    
    matches.forEach(match => {
      const cardId = match[1]
      
      if (cardMap.has(cardId)) {
        const localPath = cardMap.get(cardId)
        const fullUrl = match[0]
        
        // Replace standalone URLs
        processedContent = processedContent.replace(
          new RegExp(fullUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'),
          localPath
        )
        linksFound++
      }
    })
  })
  
  if (linksFound > 0) {
    console.log(`Converted ${linksFound} internal links for card: ${currentCard.title || currentCard.id}`)
  }
  
  return processedContent
}


// Process attachments for a card
const processAttachments = async (card, headers, attachmentDir) => {
  if (!card.content) return { processedContent: card.content || '', attachedFiles: [] }
  
  console.log(`Processing attachments for card: ${card.title || card.id}`)
  let processedContent = card.content
  let attachedFiles = []
  
  const { imageUrls, otherFileUrls } = extractFileUrls(card.content)
  
  // Process images
  for (const imageUrl of imageUrls) {
    if (!imageUrl.startsWith('http')) continue
    
    let downloadedImage = null
    
    if (imageUrl.includes('content.api.getguru.com/files/view/')) {
      // Test if Guru file is publicly accessible
      const testResponse = await fetch(imageUrl, { headers: { 'Accept': '*/*' } })
      console.log(`Public test - Status: ${testResponse.status}, Content-Type: ${testResponse.headers.get('content-type')}`)
      
      if (testResponse.ok && testResponse.headers.get('content-type') !== 'text/html') {
        console.log(`File is public, downloading: ${imageUrl}`)
        downloadedImage = await downloadFile(imageUrl, {}, attachmentDir)
      } else {
        console.log(`File is not public or returns HTML, keeping original URL: ${imageUrl}`)
      }
    } else {
      downloadedImage = await downloadFile(imageUrl, headers, attachmentDir)
    }
    
    if (downloadedImage) {
      attachedFiles.push(downloadedImage)
      const localPath = `/guru-attachments/${downloadedImage.filename}`
      processedContent = processedContent.replace(
        new RegExp(imageUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), 
        localPath
      )
    }
  }
  
  // Process other files
  if (otherFileUrls.length > 0) {
    console.log(`Found ${otherFileUrls.length} non-image attachment(s) in card`)
    
    for (const fileUrl of otherFileUrls) {
      const downloadedFile = await downloadFile(fileUrl, headers, attachmentDir)
      if (downloadedFile) {
        attachedFiles.push(downloadedFile)
      }
    }
  }
  
  if (attachedFiles.length > 0) {
    console.log(`Downloaded ${attachedFiles.length} file(s) total`)
  }
  
  return { processedContent, attachedFiles }
}


// Create node data for a card
const createCardNodeData = (card, markdownContent, attachedFiles, boardsWithParentInfo, createNodeId, createContentDigest) => {
  const { title: originalTitle, ...cardWithoutTitle } = card
  
  return {
    ...cardWithoutTitle,
    title: card.preferredPhrase || originalTitle || 'Untitled Card',
    content: markdownContent,
    contentHtml: card.content,
    attachedFiles,
    slug: createSlugFromTitle(card.preferredPhrase || originalTitle || card.id),
    boards: boardsWithParentInfo || card.boards || [],
    owner: formatUserName(card.owner),
    lastModifiedBy: formatUserName(card.lastModifiedBy),
    id: createNodeId(`guru-card-${card.id}`),
    parent: null,
    children: [],
    internal: {
      type: 'GuruCard',
      content: JSON.stringify({...card, content: markdownContent, attachedFiles, boards: boardsWithParentInfo || card.boards || []}),
      contentDigest: createContentDigest({...card, content: markdownContent, attachedFiles, boards: boardsWithParentInfo || card.boards || []})
    }
  }
}

// Process a single card (common logic for both auth modes)
const processCard = async (card, allCards, turndownService, downloadAttachments, attachmentDir, headers, createNodeId, createContentDigest, createNode) => {
  let { processedContent, attachedFiles } = { processedContent: card.content || '', attachedFiles: [] }
  
  if (downloadAttachments) {
    const result = await processAttachments(card, headers, attachmentDir)
    processedContent = result.processedContent
    attachedFiles = result.attachedFiles
  }
  
  // Convert internal Guru links to local links
  processedContent = convertInternalLinks(processedContent, card, allCards)
  
  // Convert processed HTML content to markdown
  const markdownContent = processedContent ? turndownService.turndown(processedContent) : ''
  
  const nodeData = createCardNodeData(card, markdownContent, attachedFiles, null, createNodeId, createContentDigest)
  createNode(nodeData)
}


// Fetch parent information for boards
const fetchBoardParents = async (boards, headers) => {
  const boardsWithParents = new Map()
  
  console.log(`Fetching parent information for ${boards.size} boards...`)
  
  for (const [boardId, board] of boards) {
    try {
      const parentResponse = await fetch(`${GURU_API_BASE}/folders/${boardId}/parent`, { headers })
      
      let parentFolder = null
      if (parentResponse.ok) {
        parentFolder = await parentResponse.json()
        console.log(`Board ${board.title} has parent: ${parentFolder.title}`)
      } else {
        console.log(`Board ${board.title} has no parent (${parentResponse.status})`)
      }
      
      boardsWithParents.set(boardId, { ...board, parentFolder })
    } catch (error) {
      console.warn(`Could not fetch parent for board ${boardId}:`, error.message)
      boardsWithParents.set(boardId, { ...board, parentFolder: null })
    }
  }
  
  return boardsWithParents
}

// Function to download and save files
const downloadFile = async (url, headers, downloadDir) => {
  try {
    console.log(`Downloading file from: ${url}`)
    
    let requestHeaders = { ...headers }
    if (url.includes('content.api.getguru.com')) {
      requestHeaders['Accept'] = '*/*'
      delete requestHeaders['Accept-Language']
    }
    
    const response = await fetch(url, { headers: requestHeaders })
    console.log(`Response status: ${response.status}, content-type: ${response.headers.get('content-type')}`)
    
    if (!response.ok) {
      console.warn(`Failed to download file from ${url}: ${response.status}`)
      return null
    }

    const urlPath = new URL(url).pathname
    let originalFilename = path.basename(urlPath) || 'attachment'
    let fileExtension = path.extname(originalFilename)
    
    if (!fileExtension) {
      const contentType = response.headers.get('content-type') || ''
      fileExtension = getFileExtensionFromContentType(contentType)
    }
    
    const baseName = path.basename(originalFilename, path.extname(originalFilename)) || 'file'
    const hash = crypto.createHash('md5').update(url).digest('hex').substring(0, 8)
    const filename = `${baseName}_${hash}${fileExtension}`
    const filepath = path.join(downloadDir, filename)

    ensureDirectoryExists(downloadDir)

    const buffer = await response.buffer()
    fs.writeFileSync(filepath, buffer)
    
    const contentType = response.headers.get('content-type') || 'application/octet-stream'
    console.log(`Downloaded file: ${filename} (${buffer.length} bytes, content-type: ${contentType})`)
    console.log(`File appears to be an image: ${isImageBySignature(buffer)}`)
    
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
    authMode = 'user',
    teamName,
    downloadAttachments = false,
    attachmentDir = 'static/guru-attachments'
  } = pluginOptions

  // Validate plugin options
  validateOptions(pluginOptions)
  
  // Set up authentication
  const headers = createAuthHeaders(pluginOptions)

  // Initialize turndown service
  const turndownService = new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced'
  })

  console.log('Guru Plugin: Starting data fetch...')
  console.log('Auth mode:', authMode)
  
  try {
    if (authMode === 'collection') {
      // Collection auth mode - use search API to fetch cards
      console.log('Using search API for collection auth mode')
      
      // Search for all cards - empty query returns all accessible cards
      const searchUrl = `${GURU_SEARCH_BASE}?q=`
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

      // Collect all unique boards from the search results and fetch parent information
      const allBoards = new Map()
      if (Array.isArray(searchResults)) {
        searchResults.forEach(card => {
          if (card.boards && Array.isArray(card.boards)) {
            card.boards.forEach(board => {
              allBoards.set(board.id, board)
            })
          }
        })
      }

      // Fetch parent information for all boards
      const boardsWithParents = await fetchBoardParents(allBoards, headers)

      // Create nodes for each card
      if (Array.isArray(searchResults)) {
        for (const card of searchResults) {
          let { processedContent, attachedFiles } = { processedContent: card.content || '', attachedFiles: [] }
          
          if (downloadAttachments) {
            const result = await processAttachments(card, headers, attachmentDir)
            processedContent = result.processedContent
            attachedFiles = result.attachedFiles
          }
          
          // Convert internal Guru links to local links
          processedContent = convertInternalLinks(processedContent, card, searchResults)
          
          // Convert processed HTML content to markdown
          const markdownContent = processedContent ? turndownService.turndown(processedContent) : ''
          
          // Update boards with parent information
          const boardsWithParentInfo = card.boards ? card.boards.map(board => {
            const boardWithParent = boardsWithParents.get(board.id)
            return boardWithParent || board
          }) : []
          
          const nodeData = createCardNodeData(card, markdownContent, attachedFiles, boardsWithParentInfo, createNodeId, createContentDigest)
          createNode(nodeData)
        }
      }

    } else {
      // User auth mode - fetch from team endpoints
      const cardsResponse = await fetch(
        `${GURU_API_BASE}/teams/${teamName}/cards`,
        { headers }
      )

      if (!cardsResponse.ok) {
        throw new Error(`Failed to fetch cards: ${cardsResponse.status} ${cardsResponse.statusText}`)
      }

      const cards = await cardsResponse.json()

      // Create nodes for each card using helper function
      for (const card of cards) {
        await processCard(card, cards, turndownService, downloadAttachments, attachmentDir, headers, createNodeId, createContentDigest, createNode)
      }

      // Optionally fetch collections
      if (pluginOptions.fetchCollections) {
        const collectionsResponse = await fetch(
          `${GURU_API_BASE}/teams/${teamName}/collections`,
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
          `${GURU_API_BASE}/teams/${teamName}/boards`,
          { headers }
        )

        if (boardsResponse.ok) {
          const boards = await boardsResponse.json()

          // Fetch parent information for each board
          const boardMap = new Map(boards.map(board => [board.id, board]))
          const boardsWithParentsMap = await fetchBoardParents(boardMap, headers)
          const boardsWithParents = Array.from(boardsWithParentsMap.values())

          boardsWithParents.forEach(board => {
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
  createTypes(typeDefs)
}