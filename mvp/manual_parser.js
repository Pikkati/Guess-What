/**
 * Manual Jeopardy Board Parser
 * Allows manual entry of game data from screenshots
 * Validates and stores in database
 */

const Database = require('better-sqlite3');
const readline = require('readline');

class ManualBoardParser {
  constructor(dbPath = './jeopardy.db') {
    this.db = new Database(dbPath);
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
  }

  /**
   * Interactive mode for manual data entry
   */
  async interactiveMode() {
    console.log('\n' + '═'.repeat(70));
    console.log('🎯 JEOPARDY BOARD MANUAL ENTRY TOOL');
    console.log('═'.repeat(70) + '\n');
    console.log('This tool helps you manually enter Jeopardy game data');
    console.log('based on an image screenshot.\n');

    const gameId = await this.question('Enter Game ID: ');
    const gameDate = await this.question('Enter Game Date (optional): ') || 'Unknown Date';

    // Get number of categories
    const numCategories = parseInt(await this.question('Number of categories: '));

    // Get category names
    const categories = [];
    for (let i = 0; i < numCategories; i++) {
      const catName = await this.question(`Category ${i + 1} name: `);
      categories.push(catName);
    }

    // Get clue values (typically 200, 400, 600, 800, 1000)
    const clueValues = (await this.question(
      'Clue values (comma-separated, default: 200,400,600,800,1000): '
    )).split(',').map(v => parseInt(v.trim())).filter(v => !isNaN(v));

    if (clueValues.length === 0) {
      clueValues.push(200, 400, 600, 800, 1000);
    }

    console.log(`\nEntering clues for ${categories.length} categories × ${clueValues.length} values\n`);

    const board = {
      game_id: gameId,
      date: gameDate,
      categories: categories,
      clues: [],
      grid: []
    };

    // Enter clues for each category and value
    for (const value of clueValues) {
      const rowClues = [];

      for (const category of categories) {
        const clue = await this.question(
          `\n[$${value}] ${category}:\nClue: `
        );

        const answer = await this.question('Answer: ');

        if (clue && answer) {
          board.clues.push({
            game_id: gameId,
            category: category,
            value: value,
            question: clue,
            answer: answer
          });
          rowClues.push({ clue, answer });
        } else {
          rowClues.push(null);
        }
      }

      board.grid.push({ value, clues: rowClues });
    }

    // Display summary
    this.displayBoardSummary(board);

    // Ask for confirmation
    const confirm = await this.question('\nSave this game to database? (yes/no): ');

    if (confirm.toLowerCase() === 'yes' || confirm.toLowerCase() === 'y') {
      this.saveGame(board);
      console.log('\n✓ Game saved successfully!\n');
    } else {
      console.log('\n✗ Game not saved.\n');
    }

    this.rl.close();
  }

  /**
   * Parse from JSON file format
   */
  parseFromJSON(jsonPath) {
    const fs = require('fs');

    try {
      const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

      console.log('\n' + '═'.repeat(70));
      console.log('📄 PARSING FROM JSON FILE');
      console.log('═'.repeat(70) + '\n');

      if (!data.game_id || !data.categories || !data.grid) {
        throw new Error('Invalid JSON format. Required: game_id, categories, grid');
      }

      const board = this.parseJSONStructure(data);
      this.displayBoardSummary(board);

      return board;
    } catch (error) {
      console.error('Error parsing JSON:', error.message);
      return null;
    }
  }

  /**
   * Parse JSON structure into board format
   */
  parseJSONStructure(jsonData) {
    const board = {
      game_id: jsonData.game_id,
      date: jsonData.date || 'Unknown',
      categories: jsonData.categories,
      clues: [],
      grid: jsonData.grid || []
    };

    // Flatten grid into clues array
    if (jsonData.grid) {
      jsonData.grid.forEach(row => {
        row.clues.forEach((clue, categoryIdx) => {
          if (clue) {
            board.clues.push({
              game_id: jsonData.game_id,
              category: jsonData.categories[categoryIdx],
              value: row.value,
              question: clue.clue || clue.question || clue,
              answer: clue.answer || ''
            });
          }
        });
      });
    }

    return board;
  }

  /**
   * Display board summary
   */
  displayBoardSummary(board) {
    console.log('\n' + '═'.repeat(70));
    console.log('📋 BOARD SUMMARY');
    console.log('═'.repeat(70) + '\n');

    console.log(`Game ID: ${board.game_id}`);
    console.log(`Date: ${board.date}`);
    console.log(`Categories: ${board.categories.join(', ')}`);
    console.log(`Total Clues: ${board.clues.length}\n`);

    // Show grid visualization
    console.log('Grid Layout:');
    console.log(`${"Category".padEnd(25)} | ${board.grid.map(r => `$${r.value.toString().padStart(4)}`).join(' | ')}`);
    console.log('─'.repeat(70));

    // Count filled cells
    let filledCells = 0;
    board.grid.forEach(row => {
      const filled = row.clues.filter(c => c !== null).length;
      filledCells += filled;
      console.log(`${row.clues.length} clues at $${row.value}`.padEnd(25) + ` | ${filled}/${row.clues.length} cells filled`);
    });

    const totalCells = board.categories.length * board.grid.length;
    const percentage = ((filledCells / totalCells) * 100).toFixed(1);
    console.log(`\nBoard Completion: ${filledCells}/${totalCells} cells (${percentage}%)\n`);
  }

  /**
   * Save game to database
   */
  saveGame(board) {
    const insertStmt = this.db.prepare(`
      INSERT INTO questions (category, value, question, answer)
      VALUES (?, ?, ?, ?)
    `);

    const insertMany = this.db.transaction((clues) => {
      for (const clue of clues) {
        insertStmt.run(
          clue.category,
          clue.value,
          clue.question,
          clue.answer
        );
      }
    });

    try {
      insertMany(board.clues);
      console.log(`\n✓ Saved ${board.clues.length} clues from Game ${board.game_id}`);
      return true;
    } catch (error) {
      console.error('Database error:', error.message);
      return false;
    }
  }

  /**
   * Validate existing game data
   */
  validateGame(gameId) {
    const clues = this.db.prepare(`
      SELECT * FROM questions WHERE rowid >= ? AND rowid < ?
    `).all();

    const validation = {
      game_id: gameId,
      total_clues: clues.length,
      categories: new Set(clues.map(c => c.category)).size,
      values: new Set(clues.map(c => c.value)).size,
      clues_with_answers: clues.filter(c => c.answer).length,
      quality_score: 0
    };

    validation.quality_score = (
      (validation.clues_with_answers / validation.total_clues) * 100
    ).toFixed(1);

    return validation;
  }

  /**
   * Utility function for readline questions
   */
  question(prompt) {
    return new Promise(resolve => {
      this.rl.question(prompt, resolve);
    });
  }
}

// JSON Format Example for reference
const EXAMPLE_JSON = {
  "game_id": "9384",
  "date": "February 21, 2026",
  "categories": [
    "SHE'S KIND OF A LOT POLISH AIRLINES FLIGHT ATTENDANT",
    "ON THE ROCKS",
    "AFRICAN CAPITALS",
    "CONDUCTORS",
    "TV PETS",
    "LOANWORDS"
  ],
  "grid": [
    {
      "value": 200,
      "clues": [
        {
          "clue": "Anna finds herself whistling tunes by him as she drives to LOT's hub airport in Warsaw, named for him",
          "answer": "What is Chopin?"
        },
        {
          "clue": "Being caught in a storm might have inspired Augustus Topiary to write this rhyme",
          "answer": "What is a rock and a hard place?"
        }
      ]
    }
  ]
};

// CLI usage
if (require.main === module) {
  const mode = process.argv[2];
  const parser = new ManualBoardParser('./jeopardy.db');

  if (mode === 'interactive' || !mode) {
    parser.interactiveMode().catch(console.error);
  } else if (mode === 'json' && process.argv[3]) {
    const board = parser.parseFromJSON(process.argv[3]);
    if (board) {
      parser.saveGame(board);
    }
  } else if (mode === 'example') {
    console.log('\nJSON Format Example:\n');
    console.log(JSON.stringify(EXAMPLE_JSON, null, 2));
  } else {
    console.log('Usage:');
    console.log('  node manual_parser.js interactive  - Interactive entry mode');
    console.log('  node manual_parser.js json <file>  - Parse from JSON file');
    console.log('  node manual_parser.js example      - Show JSON format example');
  }
}

module.exports = ManualBoardParser;
