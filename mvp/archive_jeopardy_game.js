/**
 * Jeopardy Game Archiver
 * Scrapes j-archive.com and extracts game data by game_id
 * 
 * Usage: node archive_jeopardy_game.js 9384
 */

const axios = require('axios');
const cheerio = require('cheerio');
const Database = require('better-sqlite3');
const fs = require('fs');

class JeopardyGameArchiver {
  constructor(dbPath = './jeopardy.db') {
    this.db = new Database(dbPath);
    this.baseUrl = 'https://j-archive.com/showgame.php';
  }

  /**
   * Fetch and parse a game from j-archive.com
   */
  async fetchGame(gameId) {
    try {
      console.log(`\n🔍 Fetching game ${gameId} from j-archive.com...\n`);
      
      const url = `${this.baseUrl}?game_id=${gameId}`;
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        timeout: 10000
      });

      const $ = cheerio.load(response.data);
      const gameData = this.parseGameData($, gameId);
      
      return gameData;
    } catch (error) {
      console.error(`❌ Error fetching game ${gameId}:`, error.message);
      return null;
    }
  }

  /**
   * Parse game data from HTML
   */
  parseGameData($, gameId) {
    const game = {
      game_id: gameId,
      date: null,
      categories: [],
      clues: [],
      errors: []
    };

    // Extract game date
    const dateMatch = $('h1').text().match(/The Jeopardy! Tournament\s+(\w+\s+\d+,\s+\d{4})?.*?Show \#(\d+)/i);
    if (dateMatch) {
      game.date = dateMatch[1] || 'Unknown Date';
      game.show_number = dateMatch[2];
    }

    // Parse the game board structure
    // j-archive uses tables with specific structure
    const gameBoard = $('#jeopardy, #double_jeopardy, #final_jeopardy');
    
    let clueId = 1;
    
    // Extract categories from column headers
    const categoryHeaders = $('tr:first td.category_name');
    categoryHeaders.each((index, element) => {
      const categoryName = $(element).text().trim();
      if (categoryName) {
        game.categories.push({
          id: index + 1,
          name: categoryName,
          round: 'Jeopardy' // Will update for Double Jeopardy/Final
        });
      }
    });

    // Extract clues and answers
    $('td.clue_text').each((index, element) => {
      const clueText = $(element).text().trim();
      const currentRow = $(element).closest('tr');
      
      // Find the dollar amount in this row
      const dollarMatch = $(element).closest('tr').find('td').first().text().match(/\$?(\d+)/);
      const dollars = dollarMatch ? dollarMatch[1] : '200';

      // Find the answer (usually in a span with class 'correct_response')
      const answerElement = $(element).next('td').find('.correct_response');
      const answerText = answerElement.length > 0 
        ? answerElement.text().trim().replace(/^Who is |^What is |^Where is /i, '')
        : 'Answer not found';

      // Determine category based on position
      const categoryIndex = $(element).closest('td').parent().find('td').index($(element).closest('td'));
      const categoryId = Math.floor(categoryIndex / 2) + 1;
      const category = game.categories[categoryId - 1] || { name: 'Unknown', id: categoryId };

      if (clueText) {
        game.clues.push({
          id: clueId++,
          game_id: gameId,
          category: category.name,
          value: parseInt(dollars),
          question: clueText,
          answer: answerText
        });
      }
    });

    return game;
  }

  /**
   * Save game data to database
   */
  saveGame(gameData) {
    if (!gameData || gameData.clues.length === 0) {
      console.log('❌ No clues found to save');
      return false;
    }

    try {
      console.log(`\n💾 Saving ${gameData.clues.length} clues to database...\n`);

      const insertStmt = this.db.prepare(`
        INSERT INTO questions (category, value, question, answer)
        VALUES (?, ?, ?, ?)
      `);

      // Create transaction for batch insert
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

      insertMany(gameData.clues);
      
      console.log(`✓ Successfully saved game ${gameData.game_id}`);
      console.log(`  - Date: ${gameData.date}`);
      console.log(`  - Categories: ${gameData.categories.length}`);
      console.log(`  - Clues: ${gameData.clues.length}\n`);

      return true;
    } catch (error) {
      console.error(`❌ Error saving game:`, error.message);
      return false;
    }
  }

  /**
   * Validate game data accuracy
   */
  validateGame(gameData) {
    const validation = {
      total_clues: gameData.clues.length,
      clues_with_answers: 0,
      clues_with_categories: 0,
      clues_with_values: 0,
      missing_answers: [],
      missing_categories: [],
      errors: []
    };

    gameData.clues.forEach((clue, index) => {
      if (clue.answer && clue.answer !== 'Answer not found') {
        validation.clues_with_answers++;
      } else {
        validation.missing_answers.push(index + 1);
      }

      if (clue.category && clue.category !== 'Unknown') {
        validation.clues_with_categories++;
      } else {
        validation.missing_categories.push(index + 1);
      }

      if (clue.value > 0) {
        validation.clues_with_values++;
      }
    });

    // Calculate accuracy percentage
    validation.accuracy = {
      answers: ((validation.clues_with_answers / validation.total_clues) * 100).toFixed(1),
      categories: ((validation.clues_with_categories / validation.total_clues) * 100).toFixed(1),
      values: ((validation.clues_with_values / validation.total_clues) * 100).toFixed(1)
    };

    return validation;
  }

  /**
   * Generate accuracy report
   */
  reportAccuracy(validation) {
    console.log('\n' + '═'.repeat(60));
    console.log('📊 GAME DATA ACCURACY REPORT');
    console.log('═'.repeat(60) + '\n');

    console.log(`Total Clues Scraped: ${validation.total_clues}`);
    console.log(`Clues with Answers: ${validation.clues_with_answers}/${validation.total_clues} (${validation.accuracy.answers}%)`);
    console.log(`Clues with Categories: ${validation.clues_with_categories}/${validation.total_clues} (${validation.accuracy.categories}%)`);
    console.log(`Clues with Values: ${validation.clues_with_values}/${validation.total_clues} (${validation.accuracy.values}%)`);

    if (validation.missing_answers.length > 0) {
      console.log(`\n⚠️  Clues missing answers: ${validation.missing_answers.join(', ')}`);
    }

    if (validation.missing_categories.length > 0) {
      console.log(`⚠️  Clues missing categories: ${validation.missing_categories.join(', ')}`);
    }

    console.log('\n' + '═'.repeat(60) + '\n');

    // Return overall accuracy
    const overallAccuracy = (
      (parseFloat(validation.accuracy.answers) + 
       parseFloat(validation.accuracy.categories) + 
       parseFloat(validation.accuracy.values)) / 3
    ).toFixed(1);

    console.log(`🎯 OVERALL ACCURACY: ${overallAccuracy}%\n`);

    return overallAccuracy;
  }

  /**
   * Full pipeline: fetch, validate, save
   */
  async archiveGame(gameId) {
    console.log('\n' + '═'.repeat(60));
    console.log(`🎬 JEOPARDY GAME ARCHIVER - Game ID: ${gameId}`);
    console.log('═'.repeat(60));

    // Fetch game data
    const gameData = await this.fetchGame(gameId);
    if (!gameData) {
      return false;
    }

    // Validate data
    const validation = this.validateGame(gameData);
    const accuracy = this.reportAccuracy(validation);

    // Save to database
    const saved = this.saveGame(gameData);

    return { gameData, validation, accuracy, saved };
  }
}

// Main execution
(async () => {
  const gameId = process.argv[2] || '9384';
  const archiver = new JeopardyGameArchiver('./jeopardy.db');
  
  try {
    const result = await archiver.archiveGame(gameId);
    
    if (result && result.saved) {
      console.log('✅ Game archival completed successfully!');
    } else {
      console.log('⚠️  Game archival completed with warnings');
    }
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
})();

module.exports = JeopardyGameArchiver;
