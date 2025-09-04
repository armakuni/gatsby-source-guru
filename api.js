// API layer for gatsby-source-guru
const fetch = require('node-fetch')
const { createAuthHeaders } = require('./utils')

// Configuration constants
const GURU_API_BASE = 'https://api.getguru.com/api/v1'
const GURU_SEARCH_BASE = 'https://api.getguru.com/api/v1/search/query'

/**
 * Fetch cards from Guru search API (collection mode) with Link header pagination
 */
const fetchCardsFromSearch = async (pluginOptions) => {
  const headers = createAuthHeaders(pluginOptions)
  
  console.log('Using search API for collection auth mode')
  
  let allCards = []
  let currentUrl = `${GURU_SEARCH_BASE}?q=`
  let pageCount = 1
  
  while (currentUrl) {
    console.log(`Fetching page ${pageCount}: ${currentUrl}`)
    
    const searchResponse = await fetch(currentUrl, { headers })

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
      console.log(`Found 0 cards on page ${pageCount} (null response)`)
      break
    }
    
    // Handle non-array responses
    if (!Array.isArray(searchResults)) {
      console.log(`Found 0 cards on page ${pageCount} (invalid response)`)
      break
    }
    
    console.log(`Found ${searchResults.length || 0} cards on page ${pageCount}`)
    
    // Add cards to collection
    if (searchResults.length > 0) {
      allCards = allCards.concat(searchResults)
      
      // Log the first card structure on first page
      if (pageCount === 1) {
        console.log('Sample card structure:', JSON.stringify(searchResults[0], null, 2))
      }
    }
    
    // Check for Link header to get next page URL
    const linkHeader = searchResponse.headers.get('link')
    currentUrl = null // Default to no more pages
    
    if (linkHeader) {
      console.log(`Link header: ${linkHeader}`)
      // Parse Link header to find next page
      // Format: <https://api.getguru.com/api/v1/search/query?q=&cursor=xyz>; rel="next"
      const nextMatch = linkHeader.match(/<([^>]+)>;\s*rel=["']?next["']?/i)
      if (nextMatch) {
        currentUrl = nextMatch[1]
        console.log(`Next page URL: ${currentUrl}`)
      } else {
        console.log('No next page found in Link header')
      }
    } else {
      console.log('No Link header found - assuming last page')
    }
    
    pageCount++
  }
  
  console.log(`Total cards fetched: ${allCards.length} across ${pageCount - 1} pages`)
  return allCards
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