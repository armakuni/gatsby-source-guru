const TurndownService = require('turndown')

// Sample HTML table from the actual Guru content
const sampleHTML = `
<div class="ghq-card-content__table-responsive-wrapper"><div class="ghq-card-content__table-scroller"><table class="ghq-card-content__table" data-ghq-card-content-type="TABLE" data-ghq-table-column-widths="217.5,217.5,217.5,132"><colgroup><col style="width:217.5px"><col style="width:217.5px"><col style="width:217.5px"><col style="width:132px"></colgroup><tbody class="ghq-card-content__table-body"><tr class="ghq-card-content__table-row" data-ghq-card-content-type="TABLE_ROW" id="JzdTnjotX7yZ"><td class="ghq-card-content__table-cell" data-ghq-card-content-type="TABLE_CELL"><p class="ghq-card-content__paragraph" data-ghq-card-content-type="paragraph">Goal</p></td><td class="ghq-card-content__table-cell" data-ghq-card-content-type="TABLE_CELL"><p class="ghq-card-content__paragraph" data-ghq-card-content-type="paragraph">Objective</p></td><td class="ghq-card-content__table-cell" data-ghq-card-content-type="TABLE_CELL"><p class="ghq-card-content__paragraph" data-ghq-card-content-type="paragraph">Output</p></td><td class="ghq-card-content__table-cell" data-ghq-card-content-type="TABLE_CELL"><p class="ghq-card-content__paragraph" data-ghq-card-content-type="paragraph">Outcome</p></td></tr><tr class="ghq-card-content__table-row" data-ghq-card-content-type="TABLE_ROW" id="NN3zY0GNNrjv"><td class="ghq-card-content__table-cell" data-ghq-card-content-type="TABLE_CELL"><p class="ghq-card-content__paragraph" data-ghq-card-content-type="paragraph">Cater for a memorable birthday party</p></td><td class="ghq-card-content__table-cell" data-ghq-card-content-type="TABLE_CELL"><p class="ghq-card-content__paragraph" data-ghq-card-content-type="paragraph">Sandwiches for 20 people that everyone can enjoy</p></td><td class="ghq-card-content__table-cell" data-ghq-card-content-type="TABLE_CELL"><p class="ghq-card-content__paragraph" data-ghq-card-content-type="paragraph">Sandwiches for different dietary requirements</p></td><td class="ghq-card-content__table-cell" data-ghq-card-content-type="TABLE_CELL"><p class="ghq-card-content__paragraph" data-ghq-card-content-type="paragraph">Happy memories</p><p class="ghq-card-content__paragraph" data-ghq-card-content-type="paragraph">Full stomachs</p></td></tr></tbody></table></div></div>
`;

// Set up the same turndown service with current table handling
const turndownService = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced'
})

// Add the updated table handling
turndownService.addRule('tables', {
  filter: 'table',
  replacement: function (content, node) {
    // Process all rows at once for better control
    const rows = Array.from(node.querySelectorAll('tr'))
    if (rows.length === 0) return ''
    
    let output = []
    let isFirstRow = true
    
    rows.forEach(row => {
      const cells = Array.from(row.querySelectorAll('th, td'))
      if (cells.length === 0) return
      
      const cellContents = cells.map(cell => {
        // Get all paragraph elements within the cell
        const paragraphs = Array.from(cell.querySelectorAll('p'))
        let cellText = ''
        
        if (paragraphs.length > 0) {
          // If we have paragraphs, join them with <br> tags for line breaks
          cellText = paragraphs.map(p => (p.textContent || '').trim()).filter(text => text).join('<br>')
        } else {
          // Otherwise, just get the text content
          cellText = (cell.textContent || '').trim()
        }
        
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
    
    return '\n\n' + output.join('\n') + '\n\n'
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

// Test the conversion
console.log('Input HTML:')
console.log(sampleHTML)
console.log('\n' + '='.repeat(50) + '\n')

const result = turndownService.turndown(sampleHTML)
console.log('Converted Markdown:')
console.log(JSON.stringify(result, null, 2))
console.log('\nActual markdown:')
console.log(result)