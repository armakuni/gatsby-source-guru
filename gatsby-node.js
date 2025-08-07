const { typeDefs } = require('./schema')
const { validateOptions, createAuthHeaders } = require('./utils')
const {
  fetchCardsFromSearch,
  fetchCardsFromTeam,
  fetchCollections,
  fetchBoards,
  fetchBoardParents
} = require('./api')
const {
  processCardsCollectionMode,
  processCardsUserMode,
  createCollectionNode,
  createBoardNode
} = require('./card-processor')


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

  console.log('Guru Plugin: Starting data fetch...')
  console.log(`Auth mode: ${authMode}`)
  
  try {
    if (authMode === 'collection') {
      // Collection auth mode - use search API to fetch cards
      const searchResults = await fetchCardsFromSearch(pluginOptions)
      const result = await processCardsCollectionMode(
        searchResults,
        pluginOptions,
        headers,
        downloadAttachments,
        attachmentDir,
        createNodeId,
        createContentDigest,
        createNode
      )
      console.log(`Collection mode: Processed ${result.cardsProcessed} cards, found ${result.boardsFound} boards`)

    } else {
      // User auth mode - fetch from team endpoints
      const cards = await fetchCardsFromTeam(teamName, pluginOptions)
      const result = await processCardsUserMode(
        cards,
        pluginOptions,
        downloadAttachments,
        attachmentDir,
        headers,
        createNodeId,
        createContentDigest,
        createNode
      )
      console.log(`User mode: Processed ${result.cardsProcessed} cards`)

      // Optionally fetch collections
      if (pluginOptions.fetchCollections) {
        const collections = await fetchCollections(teamName, headers)
        collections.forEach(collection => {
          createCollectionNode(collection, createNodeId, createContentDigest, createNode)
        })
        console.log(`Created ${collections.length} collection nodes`)
      }

      // Optionally fetch boards
      if (pluginOptions.fetchBoards) {
        const boards = await fetchBoards(teamName, headers)
        // Fetch parent information for each board
        const boardMap = new Map(boards.map(board => [board.id, board]))
        const boardsWithParentsMap = await fetchBoardParents(boardMap, headers)
        const boardsWithParents = Array.from(boardsWithParentsMap.values())

        boardsWithParents.forEach(board => {
          createBoardNode(board, createNodeId, createContentDigest, createNode)
        })
        console.log(`Created ${boardsWithParents.length} board nodes`)
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