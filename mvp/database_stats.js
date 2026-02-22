const Database = require('better-sqlite3');
const db = new Database('./jeopardy.db');

// Total number of clues/questions
const totalCount = db.prepare(`
  SELECT COUNT(*) as count FROM questions
`).get();

console.log('\n=== DATABASE STATISTICS ===\n');
console.log(`Total Clues in Database: ${totalCount.count}\n`);

// Count questions without categories
const noCategoryCount = db.prepare(`
  SELECT COUNT(*) as count FROM questions 
  WHERE category IS NULL OR category = ''
`).get();

console.log(`Clues WITHOUT Category: ${noCategoryCount.count}`);
console.log(`Clues WITH Category: ${totalCount.count - noCategoryCount.count}\n`);

// Show breakdown by category
console.log('=== CLUES PER CATEGORY ===\n');
const categoryBreakdown = db.prepare(`
  SELECT category, COUNT(*) as count 
  FROM questions 
  WHERE category IS NOT NULL AND category != ''
  GROUP BY category 
  ORDER BY count DESC
`).all();

let grandTotal = 0;
categoryBreakdown.forEach((row, index) => {
  console.log(`${index + 1}. ${row.category.padEnd(25)} : ${String(row.count).padStart(4)} clues`);
  grandTotal += row.count;
});

console.log(`\n${'─'.repeat(50)}`);
console.log(`CATEGORIZED TOTAL: ${grandTotal} clues`);
console.log(`${'─'.repeat(50)}\n`);

// Summary
const percentage = ((grandTotal / totalCount.count) * 100).toFixed(1);
console.log(`✓ ${percentage}% of clues are properly categorized`);
console.log(`✗ ${((noCategoryCount.count / totalCount.count) * 100).toFixed(1)}% are missing categories\n`);
