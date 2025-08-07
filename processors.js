// Content processing layer for gatsby-source-guru
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const TurndownService = require('turndown')
const {
  GURU_LINK_PATTERNS,
  createSlugFromTitle,
  getFileExtensionFromContentType,
  isImageBySignature,
  ensureDirectoryExists,
  extractFileUrls,
  formatUserName
} = require('./utils')
const { downloadFile } = require('./api')

/**
 * Create card map for link conversion
 */
const createCardMap = (allCards) => {
  const cardMap = new Map()
  allCards.forEach(card => {
    if (card.id) {
      const slug = createSlugFromTitle(card.preferredPhrase || card.title)
      // If slug is empty (only special characters), fall back to card ID
      const finalSlug = slug || card.id
      cardMap.set(card.id, `/pages/${finalSlug}/`)
    }
  })
  return cardMap
}

/**
 * Convert internal Guru links to local links
 */
const convertInternalLinks = (content, currentCard, allCards) => {
  if (!content || !allCards) {
    console.log(`convertInternalLinks: missing content or allCards - content: ${!!content}, allCards: ${!!allCards}`)
    return content
  }
  
  const cardMap = createCardMap(allCards)
  let processedContent = content
  let linksFound = 0
  
  // Find anchor tags with data-ghq-guru-card-id attributes (flexible order)
  const anchorTagRegex = /<a[^>]*data-ghq-guru-card-id=["']([^"']+)["'][^>]*>/gi
  
  let match
  while ((match = anchorTagRegex.exec(processedContent)) !== null) {
    const fullAnchorTag = match[0]
    const cardId = match[1]
    
    if (cardMap.has(cardId)) {
      const localPath = cardMap.get(cardId)
      
      // Replace the href in the anchor tag, handling both with and without href
      const updatedAnchorTag = fullAnchorTag.includes('href=') 
        ? fullAnchorTag.replace(/href=["']https:\/\/(app\.)?getguru\.com\/card\/[^"']*["']/i, `href="${localPath}"`)
        : fullAnchorTag.replace(/(<a[^>]*)>/i, `$1 href="${localPath}">`)
      
      processedContent = processedContent.replace(fullAnchorTag, updatedAnchorTag)
      linksFound++
    }
  }
  
  // Reset regex for next usage
  anchorTagRegex.lastIndex = 0
  
  // Also process standalone URLs using the original patterns
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

/**
 * Save downloaded file to disk
 */
const saveDownloadedFile = (url, buffer, contentType, downloadDir) => {
  const urlPath = new URL(url).pathname
  // Decode URL-encoded characters in filename
  let originalFilename = decodeURIComponent(path.basename(urlPath)) || 'attachment'
  let fileExtension = path.extname(originalFilename)
  
  if (!fileExtension) {
    fileExtension = getFileExtensionFromContentType(contentType)
  }
  
  const baseName = path.basename(originalFilename, path.extname(originalFilename)) || 'file'
  const hash = crypto.createHash('md5').update(url).digest('hex').substring(0, 8)
  const filename = `${baseName}_${hash}${fileExtension}`
  const filepath = path.join(downloadDir, filename)

  ensureDirectoryExists(downloadDir)
  fs.writeFileSync(filepath, buffer)
  
  console.log(`Downloaded file: ${filename} (${buffer.length} bytes, content-type: ${contentType})`)
  console.log(`File appears to be an image: ${isImageBySignature(buffer)}`)
  
  return {
    filename,
    filepath,
    originalUrl: url,
    size: buffer.length,
    mimeType: contentType
  }
}

/**
 * Process attachments for a card
 */
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
    
    try {
      if (imageUrl.includes('content.api.getguru.com/files/view/')) {
        // Test if Guru file is publicly accessible
        const testResult = await downloadFile(imageUrl, { 'Accept': '*/*' })
        console.log(`Public test - Status: ${testResult ? 'OK' : 'Failed'}, Content-Type: ${testResult?.contentType || 'N/A'}`)
        
        if (testResult && testResult.contentType !== 'text/html') {
          console.log(`File is public, downloading: ${imageUrl}`)
          downloadedImage = saveDownloadedFile(imageUrl, testResult.buffer, testResult.contentType, attachmentDir)
        } else {
          console.log(`File is not public or returns HTML, keeping original URL: ${imageUrl}`)
        }
      } else {
        const result = await downloadFile(imageUrl, headers)
        if (result) {
          downloadedImage = saveDownloadedFile(imageUrl, result.buffer, result.contentType, attachmentDir)
        }
      }
    } catch (error) {
      console.log(`Failed to download image ${imageUrl}: ${error.message}`)
      // Continue processing other files
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
      try {
        const result = await downloadFile(fileUrl, headers)
        if (result) {
          const downloadedFile = saveDownloadedFile(fileUrl, result.buffer, result.contentType, attachmentDir)
          attachedFiles.push(downloadedFile)
        }
      } catch (error) {
        console.log(`Failed to download file ${fileUrl}: ${error.message}`)
        // Continue processing other files
      }
    }
  }
  
  if (attachedFiles.length > 0) {
    console.log(`Downloaded ${attachedFiles.length} file(s) total`)
  }
  
  return { processedContent, attachedFiles }
}

/**
 * Initialize and configure TurndownService for HTML to Markdown conversion
 */
const createTurndownService = () => {
  const turndownService = new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced'
  })
  
  // Add complete table handling
  turndownService.addRule('guruTable', {
    filter: 'table',
    replacement: function(content, node) {
      console.log('DEBUG: TABLE CONVERSION RUNNING - FIXED VERSION!')
      const rows = Array.from(node.querySelectorAll('tr'))
      if (rows.length === 0) return ''
      
      const tableRows = []
      
      rows.forEach((row, rowIndex) => {
        const cells = Array.from(row.querySelectorAll('td, th'))
        if (cells.length === 0) return
        
        const cellTexts = cells.map(cell => {
          // Handle paragraphs specially - join with <br>
          const paragraphs = Array.from(cell.querySelectorAll('p'))
          let cellContent = ''
          
          if (paragraphs.length > 0) {
            // Join multiple paragraphs with <br>
            cellContent = paragraphs
              .map(p => (p.textContent || '').trim())
              .filter(text => text.length > 0)
              .join('<br>')
          } else if (cell.querySelector('img, a, strong, em, code, ul, ol')) {
            // If cell has complex content, process it through TurndownService recursively
            const TurndownService = require('turndown')
            const cellTurndown = new TurndownService({
              headingStyle: 'atx',
              codeBlockStyle: 'fenced'
            })
            // Convert HTML to markdown for this cell
            cellContent = cellTurndown.turndown(cell.innerHTML || '').trim()
          } else {
            // Simple text content
            cellContent = (cell.textContent || '').trim()
          }
          
          // Escape pipe characters for markdown table
          return cellContent.replace(/\|/g, '\\|')
        })
        
        // Add the data row
        tableRows.push('| ' + cellTexts.join(' | ') + ' |')
        
        // Add separator after first row (header)
        if (rowIndex === 0) {
          tableRows.push('|' + cells.map(() => ' --- ').join('|') + '|')
        }
      })
      
      const result = '\n\n' + tableRows.join('\n') + '\n\n'
      console.log('DEBUG: Table conversion result:', result)
      return result
    }
  })
  
  // Remove default table element handling to prevent interference
  turndownService.addRule('tableCell', {
    filter: ['td', 'th'],
    replacement: function() { return '' }
  })
  
  turndownService.addRule('tableRow', {
    filter: 'tr',
    replacement: function() { return '' }
  })

  return turndownService
}

/**
 * Process a single card's content
 */
const processCardContent = async (card, allCards, downloadAttachments, attachmentDir, headers) => {
  let { processedContent, attachedFiles } = { processedContent: card.content || '', attachedFiles: [] }
  
  if (downloadAttachments) {
    const result = await processAttachments(card, headers, attachmentDir)
    processedContent = result.processedContent
    attachedFiles = result.attachedFiles
  }
  
  // Convert internal Guru links to local links
  processedContent = convertInternalLinks(processedContent, card, allCards)
  
  // Convert processed HTML content to markdown
  const turndownService = createTurndownService()
  const markdownContent = processedContent ? turndownService.turndown(processedContent) : ''
  
  return { markdownContent, attachedFiles }
}

/**
 * Filter cards based on verification state
 */
const filterCardsByVerification = (cards, onlyVerified) => {
  if (!onlyVerified) return cards
  
  // Strategy: Include all TRUSTED cards, but for NEEDS_VERIFICATION cards,
  // only include them if there's no TRUSTED version with the same title
  const trustedCards = cards.filter(card => card.verificationState === 'TRUSTED')
  const unverifiedCards = cards.filter(card => card.verificationState === 'NEEDS_VERIFICATION')
  
  // Get titles of all trusted cards (normalized), prioritizing preferredPhrase
  const trustedTitles = new Set(trustedCards.map(card => 
    (card.preferredPhrase || card.title || 'Untitled').toLowerCase().trim()
  ))
  
  // Include unverified cards only if their title doesn't exist in trusted cards
  const uniqueUnverifiedCards = unverifiedCards.filter(card => {
    const cardTitle = (card.preferredPhrase || card.title || 'Untitled').toLowerCase().trim()
    return !trustedTitles.has(cardTitle)
  })
  
  const filteredCards = [...trustedCards, ...uniqueUnverifiedCards]
  
  console.log(`Processed ${filteredCards.length} cards (${trustedCards.length} trusted, ${uniqueUnverifiedCards.length} unique unverified) from ${cards.length} total`)
  
  return filteredCards
}

module.exports = {
  createCardMap,
  convertInternalLinks,
  processAttachments,
  saveDownloadedFile,
  createTurndownService,
  processCardContent,
  filterCardsByVerification
}