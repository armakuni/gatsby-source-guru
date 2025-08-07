const TurndownService = require('turndown')

// This is the ACTUAL Guru table HTML structure we need to handle
const guruTableHtml = `
<table class="ghq-card-content__table" data-ghq-card-content-type="TABLE" id="JzFsD5tpG5q2">
  <tbody class="ghq-card-content__table-body">
    <tr class="ghq-card-content__table-row">
      <td class="ghq-card-content__table-cell">
        <p class="ghq-card-content__paragraph" data-ghq-card-content-type="paragraph" id="GoalCol">Goal</p>
      </td>
      <td class="ghq-card-content__table-cell">
        <p class="ghq-card-content__paragraph" data-ghq-card-content-type="paragraph" id="ObjectiveCol">Objective</p>
      </td>
      <td class="ghq-card-content__table-cell">
        <p class="ghq-card-content__paragraph" data-ghq-card-content-type="paragraph" id="OutputCol">Output</p>
      </td>
      <td class="ghq-card-content__table-cell">
        <p class="ghq-card-content__paragraph" data-ghq-card-content-type="paragraph" id="OutcomeCol">Outcome</p>
      </td>
    </tr>
    <tr class="ghq-card-content__table-row">
      <td class="ghq-card-content__table-cell">
        <p class="ghq-card-content__paragraph" data-ghq-card-content-type="paragraph" id="PartyGoal">Cater for a memorable birthday party</p>
      </td>
      <td class="ghq-card-content__table-cell">
        <p class="ghq-card-content__paragraph" data-ghq-card-content-type="paragraph" id="SandwichObjective">Sandwiches for 20 people that everyone can enjoy</p>
      </td>
      <td class="ghq-card-content__table-cell">
        <p class="ghq-card-content__paragraph" data-ghq-card-content-type="paragraph" id="DietOutput">Sandwiches for different dietary requirements</p>
      </td>
      <td class="ghq-card-content__table-cell">
        <p class="ghq-card-content__paragraph" data-ghq-card-content-type="paragraph" id="HappyMemories">Happy memories</p>
        <p class="ghq-card-content__paragraph" data-ghq-card-content-type="paragraph" id="FullStomachs">Full stomachs</p>
      </td>
    </tr>
  </tbody>
</table>
`

console.log("Testing current Turndown behavior...")

// Test with default Turndown
const defaultTurndown = new TurndownService()
console.log("Default Turndown result:")
console.log(defaultTurndown.turndown(guruTableHtml))
console.log("\n" + "=".repeat(50) + "\n")

// Test with our fixed version
const fixedTurndown = new TurndownService()

fixedTurndown.addRule('guruTable', {
  filter: 'table',
  replacement: function(content, node) {
    const rows = Array.from(node.querySelectorAll('tr'))
    if (rows.length === 0) return ''
    
    const tableRows = []
    
    rows.forEach((row, rowIndex) => {
      const cells = Array.from(row.querySelectorAll('td, th'))
      const cellTexts = cells.map(cell => {
        // Get all paragraphs in the cell
        const paragraphs = Array.from(cell.querySelectorAll('p'))
        let cellContent = ''
        
        if (paragraphs.length > 0) {
          // Join multiple paragraphs with <br>
          cellContent = paragraphs
            .map(p => (p.textContent || '').trim())
            .filter(text => text.length > 0)
            .join('<br>')
        } else {
          // Fallback to textContent if no paragraphs
          cellContent = (cell.textContent || '').trim()
        }
        
        // Escape pipe characters
        return cellContent.replace(/\|/g, '\\|')
      })
      
      // Add the data row
      tableRows.push('| ' + cellTexts.join(' | ') + ' |')
      
      // Add separator after first row (header)
      if (rowIndex === 0) {
        tableRows.push('|' + cells.map(() => ' --- ').join('|') + '|')
      }
    })
    
    return '\n\n' + tableRows.join('\n') + '\n\n'
  }
})

// Prevent default table handling from interfering
fixedTurndown.addRule('tableCell', {
  filter: ['td', 'th'],
  replacement: () => ''
})

fixedTurndown.addRule('tableRow', {
  filter: 'tr',
  replacement: () => ''
})

console.log("Fixed Turndown result:")
const result = fixedTurndown.turndown(guruTableHtml)
console.log(result)
console.log("\n" + "=".repeat(50) + "\n")

// Verify the result
console.log("Verification:")
console.log("- Has header row:", result.includes('| Goal | Objective | Output | Outcome |'))
console.log("- Has separator:", result.includes('| --- | --- | --- | --- |'))
console.log("- Has data row:", result.includes('| Cater for a memorable birthday party |'))
console.log("- Has line breaks:", result.includes('<br>'))
console.log("- Line count:", result.split('\n').length)

// Show each line
console.log("\nLine by line:")
result.split('\n').forEach((line, i) => {
  console.log(`${i}: "${line}"`)
})