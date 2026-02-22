/**
 * Enhanced J-Archive Scraper with OCR-like Parsing
 * Handles the specific HTML structure from j-archive.com
 */

const axios = require('axios');
const cheerio = require('cheerio');
const Database = require('better-sqlite3');

class EnhancedJeopardyScraper {
  constructor(dbPath = './jeopardy.db') {
    this.db = new Database(dbPath);
    this.baseUrl = 'https://j-archive.com/showgame.php';
  }

  /**
   * Fetch the actual page HTML
   */
  async fetchPageHTML(gameId) {
    try {
      const url = `${this.baseUrl}?game_id=${gameId}`;
      console.log(`Fetching: ${url}\n`);
      
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        timeout: 15000
      });

      return response.data;
    } catch (error) {
      console.error(`Error fetching page: ${error.message}`);
      throw error;
    }
  }

  /**
   * Advanced parser based on j-archive HTML structure
   * The site uses specific div IDs and classes for game boards
   */
  async parseGame(gameId) {
    const html = await this.fetchPageHTML(gameId);
    const $ = cheerio.load(html);
    
    const gameData = {
      game_id: gameId,
      title: '',
      date: '',
      rounds: {
        jeopardy: [],
        double_jeopardy: [],
        final_jeopardy: []
      },
      allClues: [],
      stats: {
        total_clues: 0,
        total_categories: 0
      }
    };

    // Extract game metadata
    const heading = $('h1').text();
    gameData.title = heading;
    
    // Parse each round (Jeopardy, Double Jeopardy, Final Jeopardy)
    const gameBoards = $('table');
    
    gameBoards.each((boardIndex, table) => {
      const $table = $(table);
      const boardData = this.parseBoardTable($table, $, gameId);
      
      if (boardData.clues.length > 0) {
        if (boardIndex === 0) {
          gameData.rounds.jeopardy = boardData;
        } else if (boardIndex === 1) {
          gameData.rounds.double_jeopardy = boardData;
        } else if (boardIndex === 2) {
          gameData.rounds.final_jeopardy = boardData;
        }
        
        gameData.allClues.push(...boardData.clues);
      }
    });

    gameData.stats.total_clues = gameData.allClues.length;
    gameData.stats.total_categories = new Set(gameData.allClues.map(c => c.category)).size;

    return gameData;
  }

  /**
   * Parse a single game board table
   * j-archive tables have: header row with categories, then rows of clues
   */
  parseBoardTable($table, $, gameId) {
    const board = {
      categories: [],
      clues: [],
      roundType: 'Jeopardy'
    };

    // Find category headers (usually <td> with category_name class)
    const categoryRow = $table.find('tr').first();
    let categoryIndex = 0;

    categoryRow.find('td').each((idx, td) => {
      const categoryText = $(td).text().trim();
      const categoryValue = $(td).find('.category_name').text().trim();
      
      if (categoryValue) {
        board.categories.push({
          id: categoryIndex,
          name: categoryValue
        });
        categoryIndex++;
      }
    });

    // Parse clue rows
    $table.find('tr').slice(1).each((rowIdx, tr) => {
      $(tr).find('td').each((colIdx, td) => {
        const $td = $(td);
        const clueContent = $td.html();

        // Look for the clue structure
        if (clueContent && clueContent.includes('class="clue_text"')) {
          const clueText = $td.find('.clue_text').attr('onmouseover') || $td.find('.clue_text').text();
          const clueValue = $td.find('em').text().match(/\d+/)?.[0] || '200';
          
          // Find the answer
          let answerText = 'Not found';
          const responseMatch = clueContent.match(/<em class="correct_response"[^>]*>([^<]+)<\/em>/);
          if (responseMatch) {
            answerText = responseMatch[1].trim();
          }

          const categoryId = Math.floor(colIdx / 2);
          const category = board.categories[categoryId]?.name || 'Unknown';

          board.clues.push({
            game_id: gameId,
            category: category,
            value: parseInt(clueValue) || 200,
            question: clueText || 'Clue text not found',
            answer: answerText,
            round: board.roundType
          });
        }
      });
    });

    return board;
  }

  /**
   * Alternative parsing method using regex patterns
   * Useful when standard parsing fails
   */
  parseGameRegex(html) {
    const gameData = {
      clues: []
    };

    // Pattern for clue structure in j-archive
    const cluePattern = /class="clue_text"[^>]*onmouseover="[^"]*([^"]*)"[^>]*>([^<]*)<\/div>[\s\S]*?<em[^>]*>([^<]*)<\/em>/g;
    
    let match;
    let clueId = 1;

    while ((match = cluePattern.exec(html)) !== null) {
      gameData.clues.push({
        id: clueId++,
        question: match[1] || match[2],
        answer: match[3]
      });
    }

    return gameData;
  }

  /**
   * Validation and accuracy check
   */
  validateGameData(gameData) {
    const validation = {
      total_clues: gameData.allClues.length,
      jeopardy_clues: gameData.rounds.jeopardy.clues?.length || 0,
      double_jeopardy_clues: gameData.rounds.double_jeopardy.clues?.length || 0,
      final_jeopardy_clues: gameData.rounds.final_jeopardy.clues?.length || 0,
      total_categories: gameData.stats.total_categories,
      clues_with_answers: gameData.allClues.filter(c => c.answer && c.answer !== 'Not found').length,
      clues_with_categories: gameData.allClues.filter(c => c.category && c.category !== 'Unknown').length,
      quality_score: 0
    };

    // Calculate quality score
    const answerScore = (validation.clues_with_answers / validation.total_clues) * 100;
    const categoryScore = (validation.clues_with_categories / validation.total_clues) * 100;
    validation.quality_score = ((answerScore + categoryScore) / 2).toFixed(1);

    return validation;
  }

  /**
   * Save game data to database
   */
  saveGameData(gameData) {
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
      insertMany(gameData.allClues);
      return true;
    } catch (error) {
      console.error('Database error:', error.message);
      return false;
    }
  }

  /**
   * Full archival pipeline
   */
  async archiveGame(gameId) {
    try {
      console.log('\n' + '═'.repeat(70));
      console.log(`📺 JEOPARDY GAME ARCHIVER - Game ID: ${gameId}`);
      console.log('═'.repeat(70) + '\n');

      // Parse game
      console.log('📖 Parsing game data...\n');
      const gameData = await this.parseGame(gameId);

      // Validate
      console.log('✓ Validating parsed data...\n');
      const validation = this.validateGameData(gameData);

      // Report
      this.reportValidation(validation, gameData);

      // Save
      console.log('💾 Saving to database...');
      const saved = this.saveGameData(gameData);

      if (saved) {
        console.log(`✓ Successfully archived ${gameData.allClues.length} clues\n`);
      }

      return { gameData, validation, saved };
    } catch (error) {
      console.error('Error archiving game:', error.message);
      return { saved: false, error: error.message };
    }
  }

  /**
   * Generate validation report
   */
  reportValidation(validation, gameData) {
    console.log('📊 VALIDATION REPORT\n');
    console.log(`Total Clues Scraped: ${validation.total_clues}`);
    console.log(`  - Jeopardy Round: ${validation.jeopardy_clues} clues`);
    console.log(`  - Double Jeopardy: ${validation.double_jeopardy_clues} clues`);
    console.log(`  - Final Jeopardy: ${validation.final_jeopardy_clues} clues`);
    console.log(`\nCategories Found: ${validation.total_categories}`);
    console.log(`\nData Quality:`);
    console.log(`  - Clues with Answers: ${validation.clues_with_answers}/${validation.total_clues} (${((validation.clues_with_answers/validation.total_clues)*100).toFixed(1)}%)`);
    console.log(`  - Clues with Categories: ${validation.clues_with_categories}/${validation.total_clues} (${((validation.clues_with_categories/validation.total_clues)*100).toFixed(1)}%)`);
    console.log(`\n🎯 Quality Score: ${validation.quality_score}%\n`);

    // Show sample clues
    if (gameData.allClues.length > 0) {
      console.log('Sample Clues:');
      gameData.allClues.slice(0, 3).forEach((clue, idx) => {
        console.log(`  ${idx + 1}. [${clue.category}] $${clue.value}: ${clue.question.substring(0, 50)}...`);
      });
      console.log();
    }
  }
}

// Main execution
(async () => {
  const gameId = process.argv[2] || '9384';
  const scraper = new EnhancedJeopardyScraper('./jeopardy.db');
  
  const result = await scraper.archiveGame(gameId);
  
  if (!result.saved) {
    console.log('⚠️  Note: This is a test run. The j-archive.com HTML structure');
    console.log('may require adjustments based on actual page content.\n');
  }
})();

module.exports = EnhancedJeopardyScraper;
