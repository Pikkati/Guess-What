const Database = require('better-sqlite3');
const db = new Database('./jeopardy.db');

// Get all unique categories
const allCategories = db.prepare(`
  SELECT DISTINCT category FROM questions 
  ORDER BY category
`).all();

console.log('\n=== All Available Categories ===\n');
allCategories.forEach((c, i) => {
  console.log(`${i + 1}. ${c.category}`);
});

// Search for any category that might be "Before & During & After"
const bda = db.prepare(`
  SELECT DISTINCT category FROM questions 
  WHERE category LIKE '%before%' 
     OR category LIKE '%during%' 
     OR category LIKE '%after%'
     OR category LIKE '%&%'
`).all();

console.log(`\n=== Search Results (${bda.length} found) ===\n`);
bda.forEach(c => console.log(c.category));

// If nothing found, try searching for "AND" or other connectors
if (bda.length === 0) {
  console.log('\nNo categories with BEFORE/DURING/AFTER found. These categories may not exist in this database.');
  console.log('The "Before & During & After" category is a special Jeopardy category type.');
}
