// API layer for gatsby-source-guru
const fetch = require('node-fetch')
const { createAuthHeaders } = require('./utils')

// Configuration constants
const GURU_API_BASE = 'https://api.getguru.com/api/v1'
const GURU_SEARCH_BASE = 'https://api.getguru.com/api/v1/search/query'

/**
 * Fetch cards from Guru search API (collection mode)
 */
const fetchCardsFromSearch = async (pluginOptions) => {
  const headers = createAuthHeaders(pluginOptions)
  const searchUrl = `${GURU_SEARCH_BASE}?q=`
  
  console.log('Using search API for collection auth mode')
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
  
  // Handle null responses
  if (searchResults === null) {
    console.log('Found 0 cards via search (null response)')
    return null
  }
  
  // Handle non-array responses
  if (!Array.isArray(searchResults)) {
    console.log('Found 0 cards via search (invalid response)')
    return []
  }
  
  console.log(`Found ${searchResults.length || 0} cards via search`)
  
  // Log the first card to see its structure
  if (searchResults.length > 0) {
    console.log('Sample card structure:', JSON.stringify(searchResults[0], null, 2))
  }

  return searchResults
}

/**
 * Fetch cards from team API (user mode)
 */
const fetchCardsFromTeam = async (teamName, pluginOptions) => {
  const headers = createAuthHeaders(pluginOptions)
  
  const cardsResponse = await fetch(
    `${GURU_API_BASE}/teams/${teamName}/cards`,
    { headers }
  )

  if (!cardsResponse.ok) {
    throw new Error(`Failed to fetch cards: ${cardsResponse.status} ${cardsResponse.statusText}`)
  }

  return await cardsResponse.json()
}

/**
 * Fetch parent information for boards
 */
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

/**
 * Fetch collections for a team (user mode only)
 */
const fetchCollections = async (teamName, headers) => {
  const collectionsResponse = await fetch(
    `${GURU_API_BASE}/teams/${teamName}/collections`,
    { headers }
  )

  if (!collectionsResponse.ok) {
    throw new Error(`Failed to fetch collections: ${collectionsResponse.status} ${collectionsResponse.statusText}`)
  }

  return await collectionsResponse.json()
}

/**
 * Fetch boards for a team (user mode only)
 */
const fetchBoards = async (teamName, headers) => {
  const boardsResponse = await fetch(
    `${GURU_API_BASE}/teams/${teamName}/boards`,
    { headers }
  )

  if (!boardsResponse.ok) {
    throw new Error(`Failed to fetch boards: ${boardsResponse.status} ${boardsResponse.statusText}`)
  }

  return await boardsResponse.json()
}

/**
 * Download a file from a URL
 */
const downloadFile = async (url, headers) => {
  console.log(`Downloading file from: ${url}`)
  
  try {
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

    return {
      buffer: await response.buffer(),
      contentType: response.headers.get('content-type') || 'application/octet-stream'
    }
  } catch (error) {
    console.warn(`Network error downloading file from ${url}: ${error.message}`)
    return null
  }
}

module.exports = {
  fetchCardsFromSearch,
  fetchCardsFromTeam,
  fetchBoardParents,
  fetchCollections,
  fetchBoards,
  downloadFile,
  GURU_API_BASE,
  GURU_SEARCH_BASE
}