// Card processing logic for gatsby-source-guru
const { formatUserName, createSlugFromTitle } = require('./utils')
const { processCardContent, filterCardsByVerification } = require('./processors')
const { fetchBoardParents } = require('./api')

/**
 * Create node data for a card
 */
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

/**
 * Process a single card and create its Gatsby node
 */
const processAndCreateCardNode = async (
  card,
  allCards,
  downloadAttachments,
  attachmentDir,
  headers,
  createNodeId,
  createContentDigest,
  createNode,
  boardsWithParents = null
) => {
  const { markdownContent, attachedFiles } = await processCardContent(
    card,
    allCards,
    downloadAttachments,
    attachmentDir,
    headers
  )
  
  // Update boards with parent information if provided
  const boardsWithParentInfo = card.boards && boardsWithParents
    ? card.boards.map(board => boardsWithParents.get(board.id) || board)
    : card.boards || []
  
  const nodeData = createCardNodeData(
    card,
    markdownContent,
    attachedFiles,
    boardsWithParentInfo,
    createNodeId,
    createContentDigest
  )
  
  createNode(nodeData)
  return nodeData
}

/**
 * Process cards for collection auth mode
 */
const processCardsCollectionMode = async (
  searchResults,
  pluginOptions,
  headers,
  downloadAttachments,
  attachmentDir,
  createNodeId,
  createContentDigest,
  createNode
) => {
  // Collect all unique boards from the search results
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

  // Filter cards if onlyVerified option is enabled
  const cardsToProcess = filterCardsByVerification(searchResults, pluginOptions.onlyVerified)

  // Create nodes for each card
  const processedCards = []
  if (Array.isArray(cardsToProcess)) {
    for (const card of cardsToProcess) {
      const nodeData = await processAndCreateCardNode(
        card,
        cardsToProcess,
        downloadAttachments,
        attachmentDir,
        headers,
        createNodeId,
        createContentDigest,
        createNode,
        boardsWithParents
      )
      processedCards.push(nodeData)
    }
  }

  return {
    cardsProcessed: processedCards.length,
    boardsFound: allBoards.size
  }
}

/**
 * Process cards for user auth mode
 */
const processCardsUserMode = async (
  cards,
  pluginOptions,
  downloadAttachments,
  attachmentDir,
  headers,
  createNodeId,
  createContentDigest,
  createNode
) => {
  // Filter cards if onlyVerified option is enabled
  const cardsToProcess = filterCardsByVerification(cards, pluginOptions.onlyVerified)

  // Create nodes for each card
  const processedCards = []
  for (const card of cardsToProcess) {
    const nodeData = await processAndCreateCardNode(
      card,
      cardsToProcess,
      downloadAttachments,
      attachmentDir,
      headers,
      createNodeId,
      createContentDigest,
      createNode
    )
    processedCards.push(nodeData)
  }

  return {
    cardsProcessed: processedCards.length
  }
}

/**
 * Create collection node
 */
const createCollectionNode = (collection, createNodeId, createContentDigest, createNode) => {
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
  return nodeData
}

/**
 * Create board node
 */
const createBoardNode = (board, createNodeId, createContentDigest, createNode) => {
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
  return nodeData
}

module.exports = {
  createCardNodeData,
  processAndCreateCardNode,
  processCardsCollectionMode,
  processCardsUserMode,
  createCollectionNode,
  createBoardNode
}