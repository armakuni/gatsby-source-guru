const TurndownService = require('turndown')

// Real HTML from the GraphQL response
const realTableHTML = `<div class="ghq-card-content__table-responsive-wrapper"><div class="ghq-card-content__table-scroller"><table class="ghq-card-content__table" data-ghq-card-content-type="TABLE" data-ghq-table-column-widths="217.5,217.5,217.5,132"><colgroup><col style="width:217.5px"><col style="width:217.5px"><col style="width:217.5px"><col style="width:132px"></colgroup><tbody class="ghq-card-content__table-body"><tr class="ghq-card-content__table-row" data-ghq-card-content-type="TABLE_ROW" id="JzdTnjotX7yZ"><td class="ghq-card-content__table-cell" data-ghq-card-content-type="TABLE_CELL"><p class="ghq-card-content__paragraph" data-ghq-card-content-type="paragraph">Goal</p></td><td class="ghq-card-content__table-cell" data-ghq-card-content-type="TABLE_CELL"><p class="ghq-card-content__paragraph" data-ghq-card-content-type="paragraph">Objective</p></td><td class="ghq-card-content__table-cell" data-ghq-card-content-type="TABLE_CELL"><p class="ghq-card-content__paragraph" data-ghq-card-content-type="paragraph">Output</p></td><td class="ghq-card-content__table-cell" data-ghq-card-content-type="TABLE_CELL"><p class="ghq-card-content__paragraph" data-ghq-card-content-type="paragraph">Outcome</p></td></tr><tr class="ghq-card-content__table-row" data-ghq-card-content-type="TABLE_ROW" id="NN3zY0GNNrjv"><td class="ghq-card-content__table-cell" data-ghq-card-content-type="TABLE_CELL"><p class="ghq-card-content__paragraph" data-ghq-card-content-type="paragraph">Cater for a memorable birthday party</p></td><td class="ghq-card-content__table-cell" data-ghq-card-content-type="TABLE_CELL"><p class="ghq-card-content__paragraph" data-ghq-card-content-type="paragraph">Sandwiches for 20 people that everyone can enjoy</p></td><td class="ghq-card-content__table-cell" data-ghq-card-content-type="TABLE_CELL"><p class="ghq-card-content__paragraph" data-ghq-card-content-type="paragraph">Sandwiches for different dietary requirements</p></td><td class="ghq-card-content__table-cell" data-ghq-card-content-type="TABLE_CELL"><p class="ghq-card-content__paragraph" data-ghq-card-content-type="paragraph">Happy memories</p><p class="ghq-card-content__paragraph" data-ghq-card-content-type="paragraph">Full stomachs</p></td></tr></tbody></table></div></div>`

// Set up exactly like the plugin
const turndownService = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced'
})

// Add the current table handling
turndownService.addRule('tables', {
  filter: 'table',
  replacement: function (content, node) {
    console.log('DEBUG: Table replacement function called')
    console.log('DEBUG: node.querySelectorAll available?', typeof node.querySelectorAll)
    
    // Process all rows at once for better control
    const rows = Array.from(node.querySelectorAll('tr'))
    console.log('DEBUG: Found rows:', rows.length)
    
    if (rows.length === 0) return ''
    
    let output = []
    let isFirstRow = true
    
    rows.forEach((row, rowIndex) => {
      console.log(`DEBUG: Processing row ${rowIndex}`)
      const cells = Array.from(row.querySelectorAll('th, td'))
      console.log(`DEBUG: Row ${rowIndex} has ${cells.length} cells`)
      
      if (cells.length === 0) return
      
      const cellContents = cells.map((cell, cellIndex) => {
        console.log(`DEBUG: Processing cell ${cellIndex}`)
        
        // Get all paragraph elements within the cell
        const paragraphs = Array.from(cell.querySelectorAll('p'))
        console.log(`DEBUG: Cell ${cellIndex} has ${paragraphs.length} paragraphs`)
        
        let cellText = ''
        
        if (paragraphs.length > 0) {
          // If we have paragraphs, join them with <br> tags for line breaks
          const paragraphTexts = paragraphs.map(p => (p.textContent || '').trim()).filter(text => text)
          console.log(`DEBUG: Paragraph texts:`, paragraphTexts)
          cellText = paragraphTexts.join('<br>')
        } else {
          // Otherwise, just get the text content
          cellText = (cell.textContent || '').trim()
        }
        
        console.log(`DEBUG: Cell ${cellIndex} final text: "${cellText}"`)
        
        // Clean up multiple spaces and escape pipes
        cellText = cellText.replace(/[ \t]+/g, ' ').replace(/\|/g, '\\|')
        return cellText
      })
      
      // Add the row
      output.push('| ' + cellContents.join(' | ') + ' |')
      
      // After first row, add separator
      if (isFirstRow) {
        output.push('|' + cells.map(() => ' --- ').join('|') + '|')
        isFirstRow = false
      }
    })
    
    const result = '\n\n' + output.join('\n') + '\n\n'
    console.log('DEBUG: Final table markdown:', result)
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

console.log('Converting real HTML...')
const result = turndownService.turndown(realTableHTML)
console.log('\nFinal result:')
console.log(result)