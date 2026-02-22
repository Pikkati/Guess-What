# 🎬 Jeopardy Game Archival System

Complete system for archiving Jeopardy games from j-archive.com and local sources.

## 📋 Overview

This system provides multiple methods to archive Jeopardy games:

1. **Web Scraping** - Automatically fetch from j-archive.com
2. **Image Analysis** - Extract data from screenshot images (OCR)
3. **Manual Entry** - Interactive CLI for manual data entry
4. **JSON Import** - Import from structured JSON files

## 🛠️ Tools Included

### 1. `archive_jeopardy_game.js`
Scrapes games directly from j-archive.com and saves to database.

```bash
node archive_jeopardy_game.js 9384
```

**Features:**
- Automatic page fetching
- HTML parsing
- Data validation
- Database insertion
- Accuracy reporting

### 2. `enhanced_scraper.js`
Advanced scraper with better j-archive.com HTML structure handling.

```bash
node enhanced_scraper.js 9384
```

**Features:**
- Multiple board parsing (Jeopardy, Double Jeopardy, Final)
- Better category extraction
- Round detection
- Quality scoring

### 3. `image_analyzer.js`
Extracts game data from screenshot images using OCR.

```bash
node image_analyzer.js path/to/image.png
```

**Features:**
- Tesseract.js OCR integration
- Text extraction from images
- Board structure parsing
- Comparison with archive data

### 4. `manual_parser.js`
Interactive CLI tool for manual game entry.

```bash
# Interactive mode
node manual_parser.js interactive

# JSON import
node manual_parser.js json game_9384.json

# Show JSON format example
node manual_parser.js example
```

**Features:**
- Step-by-step data entry
- JSON file support
- Board visualization
- Completion percentage tracking

### 5. `test_game_archival.js`
Comprehensive testing and validation suite.

```bash
# Archive and test a game
node test_game_archival.js 9384

# Archive, test, and validate
node test_game_archival.js 9384 validate

# Show database statistics
node test_game_archival.js stats
```

## 📊 Game Data Structure

### Board Layout
```
CATEGORY_1          CATEGORY_2          CATEGORY_3
───────────────────────────────────────────────────
$200 [Clue text]    $200 [Clue text]    $200 [Clue text]
$400 [Clue text]    $400 [Clue text]    $400 [Clue text]
$600 [Clue text]    $600 [Clue text]    $600 [Clue text]
$800 [Clue text]    $800 [Clue text]    $800 [Clue text]
$1000 [Clue text]   $1000 [Clue text]   $1000 [Clue text]
```

### JSON Format Example
```json
{
  "game_id": "9384",
  "date": "February 21, 2026",
  "categories": [
    "CATEGORY_1",
    "CATEGORY_2",
    "CATEGORY_3"
  ],
  "grid": [
    {
      "value": 200,
      "clues": [
        {
          "clue": "Clue text here",
          "answer": "Answer in response form"
        },
        {
          "clue": "Another clue",
          "answer": "Another answer"
        }
      ]
    },
    {
      "value": 400,
      "clues": [...]
    }
  ]
}
```

## 🎯 Workflow

### Recommended Approach

1. **Try Automatic Scraping**
   ```bash
   node archive_jeopardy_game.js 9384
   ```

2. **If scraping fails, use Manual Entry**
   ```bash
   node manual_parser.js interactive
   ```

3. **Import from JSON** (if you have pre-formatted data)
   ```bash
   node manual_parser.js json game_9384.json
   ```

4. **Test & Validate**
   ```bash
   node test_game_archival.js 9384 validate
   ```

## 📈 Validation & Accuracy

Each tool performs automatic validation:

- ✓ Clues extracted: All game clues identified
- ✓ Categories matched: Clues linked to categories
- ✓ Values assigned: Dollar amounts correct
- ✓ Answers present: Response text captured
- ✓ Data integrity: No duplicates or corruption

**Quality Score Calculation:**
```
Quality = (Categories OK + Values OK + Answers OK + Text OK) / 4 × 100%
```

## 🔍 Database Schema

```sql
CREATE TABLE questions (
  id INTEGER PRIMARY KEY,
  category TEXT,
  value INTEGER,
  question TEXT,
  answer TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## 📊 Example: Archiving Game 9384

### Step 1: Fetch and Archive
```bash
$ node archive_jeopardy_game.js 9384

🔍 Fetching game 9384 from j-archive.com...

GET https://j-archive.com/showgame.php?game_id=9384

✓ Page fetched
📖 Parsing game data...
✓ Extracted 30 clues
✓ Found 6 categories
💾 Saving to database...
✓ Successfully saved game 9384
```

### Step 2: Validate Results
```bash
$ node test_game_archival.js 9384 validate

📊 Database Statistics:
Total Clues: 381 (earlier 351 + 30 new)
Quality Score: 98.5%
Categories: 24 total
```

### Step 3: Verify Accuracy
```bash
$ node test_game_archival.js stats

📊 DATABASE STATISTICS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Total Clues: 381

Clues by Category (24 categories):
1. Sports ..................... : 40 clues
2. Science ..................... : 40 clues
3. Literature .................. : 40 clues
... (more categories)
```

## 🐛 Troubleshooting

### "Cannot find module 'better-sqlite3'"
```bash
npm install better-sqlite3
```

### "Cannot find module 'axios' or 'cheerio'"
```bash
npm install axios cheerio
```

### "j-archive.com connection failed"
- Check internet connection
- j-archive.com may be temporarily down
- Try manual entry instead: `node manual_parser.js interactive`

### "OCR not working"
```bash
npm install tesseract.js
```

## 📝 Advanced Usage

### Batch Archive Multiple Games
```javascript
const Archiver = require('./archive_jeopardy_game.js');
const gameIds = [9384, 9385, 9386];

for (const gameId of gameIds) {
  const archiver = new Archiver();
  await archiver.archiveGame(gameId);
}
```

### Custom Validation
```javascript
const Tester = require('./test_game_archival.js');
const tester = new Tester();
const results = await tester.testArchival(9384, true);
console.log(`Quality: ${results.testResults.validation.quality_score}%`);
```

## 📚 Data Model Integration

Once archived, games are stored in the questions table:

```sql
-- Query all clues from a specific category
SELECT * FROM questions WHERE category = 'SPORTS';

-- Get high-value clues
SELECT * FROM questions WHERE value >= 800;

-- Find clues by category and value
SELECT question, answer FROM questions 
WHERE category = 'HISTORY' AND value = 600;
```

## ✅ Quality Assurance Checklist

- [ ] Game fetched successfully
- [ ] All 30 clues extracted (6 categories × 5 values)
- [ ] Categories properly assigned
- [ ] Values (200-1000) correct
- [ ] Answers in proper Jeopardy format
- [ ] No duplicate clues
- [ ] Quality score > 95%
- [ ] Database queries work correctly

## 🎓 Learning Outcomes

This system teaches:
- Web scraping with Cheerio
- OCR text extraction
- Interactive CLI design
- Database transactions
- Data validation patterns
- Error handling
- Testing & verification

## 📞 Support

For issues or questions:
1. Check this documentation
2. Review tool-specific error messages
3. Try alternative archival method
4. Check database with: `node test_game_archival.js stats`

---

**Last Updated:** February 21, 2026
**Version:** 1.0.0
**Status:** ✅ Production Ready
