/**
 * Jeopardy Board Image Analysis & OCR
 * Extracts game data from screenshot images
 * 
 * The user's image shows:
 * - Top row: Category names (colored boxes)
 * - Below: Dollar values with clue text
 * - Pattern repeats for each row
 */

const Tesseract = require('tesseract.js');
const fs = require('fs');
const path = require('path');

class JeopardyImageAnalyzer {
  /**
   * Analyze a Jeopardy board image
   * Extracts text using OCR
   */
  async analyzeImage(imagePath) {
    try {
      console.log('\n📸 Starting Image Analysis...\n');
      console.log(`Analyzing: ${imagePath}\n`);

      if (!fs.existsSync(imagePath)) {
        throw new Error(`Image file not found: ${imagePath}`);
      }

      // Use Tesseract.js for OCR
      const result = await Tesseract.recognize(imagePath, 'eng', {
        logger: m => {
          if (m.status === 'recognizing text') {
            process.stdout.write(`\rProgress: ${(m.progress * 100).toFixed(1)}%`);
          }
        }
      });

      console.log('\n✓ OCR Complete\n');

      // Parse the extracted text
      const gameData = this.parseOCRText(result.data.text);
      
      return {
        raw_text: result.data.text,
        parsed_data: gameData,
        confidence: result.data.confidence
      };
    } catch (error) {
      console.error('Error analyzing image:', error.message);
      return null;
    }
  }

  /**
   * Parse OCR-extracted text into structured format
   * Expected format based on user's description:
   * CATEGORY_NAME (top)
   * $200 (clue text here)
   * $400 (clue text here)
   * ... etc
   */
  parseOCRText(text) {
    const lines = text.split('\n').filter(line => line.trim());
    const board = {
      categories: [],
      clues: [],
      structure: {}
    };

    // Patterns to identify different elements
    const categoryPattern = /^[A-Z\s\&\-\']+$/;  // All caps = category
    const dollarPattern = /^\$?(\d+)$/;          // Dollar amounts
    const cluePattern = /^(?!\$)(?![A-Z\s&\-])/; // Everything else

    let currentCategory = null;
    let currentPosition = 0;

    for (const line of lines) {
      const trimmed = line.trim();

      // Check if this is a category name
      if (categoryPattern.test(trimmed) && !dollarPattern.test(trimmed)) {
        currentCategory = trimmed;
        if (!board.categories.includes(currentCategory)) {
          board.categories.push({
            name: currentCategory,
            clues: []
          });
        }
        continue;
      }

      // Check if this is a dollar amount
      const dollarMatch = trimmed.match(dollarPattern);
      if (dollarMatch) {
        currentPosition = parseInt(dollarMatch[1]);
        continue;
      }

      // If we have a category and position, this is a clue
      if (currentCategory && currentPosition) {
        board.clues.push({
          category: currentCategory,
          value: currentPosition,
          question: trimmed,
          answer: 'To be extracted' // Answers would need separate source
        });
      }
    }

    return board;
  }

  /**
   * Manual board structure parser
   * Based on the colored boxes and line structure in the image
   */
  parseManualStructure(boardDescription) {
    // This function helps when OCR fails or needs verification
    // Takes manually defined structure:
    // {
    //   "categories": ["CAT1", "CAT2", ...],
    //   "rows": [
    //     { "dollar": 200, "clues": ["clue1", "clue2", ...] },
    //     ...
    //   ]
    // }

    const board = {
      categories: boardDescription.categories || [],
      clues: [],
      grid: []
    };

    if (boardDescription.rows) {
      boardDescription.rows.forEach(row => {
        const dollarValue = row.dollar;
        
        (row.clues || []).forEach((clueText, categoryIndex) => {
          if (clueText && board.categories[categoryIndex]) {
            board.clues.push({
              category: board.categories[categoryIndex],
              value: dollarValue,
              question: clueText,
              answer: 'Unknown' // Would be populated from j-archive
            });
          }
        });
      });
    }

    return board;
  }

  /**
   * Compare image-parsed data with j-archive data
   */
  compareData(imageData, archiveData) {
    const comparison = {
      image_clues: imageData.clues.length,
      archive_clues: archiveData.allClues.length,
      matching_categories: 0,
      matching_clues: 0,
      accuracy: 0,
      mismatches: []
    };

    // Match categories
    const imageCategories = new Set(imageData.clues.map(c => c.category));
    const archiveCategories = new Set(archiveData.allClues.map(c => c.category));

    imageCategories.forEach(cat => {
      if (archiveCategories.has(cat)) {
        comparison.matching_categories++;
      } else {
        comparison.mismatches.push(`Category mismatch: "${cat}" not in archive`);
      }
    });

    // Match clues by category and value
    imageData.clues.forEach(imageClue => {
      const matching = archiveData.allClues.find(archClue =>
        archClue.category === imageClue.category &&
        archClue.value === imageClue.value
      );

      if (matching) {
        comparison.matching_clues++;
      } else {
        comparison.mismatches.push(
          `Clue mismatch: [${imageClue.category}] $${imageClue.value}`
        );
      }
    });

    // Calculate accuracy
    const maxClues = Math.max(imageData.clues.length, archiveData.allClues.length);
    comparison.accuracy = ((comparison.matching_clues / maxClues) * 100).toFixed(1);

    return comparison;
  }

  /**
   * Report image analysis results
   */
  reportAnalysis(analysis, imagePath) {
    console.log('\n' + '═'.repeat(70));
    console.log(`📊 IMAGE ANALYSIS REPORT: ${path.basename(imagePath)}`);
    console.log('═'.repeat(70) + '\n');

    if (analysis.parsed_data) {
      console.log(`Categories Detected: ${analysis.parsed_data.categories.length}`);
      console.log(`Clues Extracted: ${analysis.parsed_data.clues.length}`);
      console.log(`OCR Confidence: ${analysis.confidence?.toFixed(1)}%\n`);

      console.log('Categories Found:');
      analysis.parsed_data.categories.forEach((cat, idx) => {
        const catName = typeof cat === 'string' ? cat : cat.name;
        console.log(`  ${idx + 1}. ${catName}`);
      });

      console.log('\nSample Clues:');
      analysis.parsed_data.clues.slice(0, 5).forEach((clue, idx) => {
        console.log(`  ${idx + 1}. [$${clue.value}] ${clue.category}: ${clue.question.substring(0, 50)}...`);
      });
    }

    console.log('\n' + '═'.repeat(70) + '\n');
  }

  /**
   * Generate comparison report
   */
  reportComparison(comparison) {
    console.log('\n' + '═'.repeat(70));
    console.log('🔍 IMAGE vs ARCHIVE COMPARISON');
    console.log('═'.repeat(70) + '\n');

    console.log(`Image Clues: ${comparison.image_clues}`);
    console.log(`Archive Clues: ${comparison.archive_clues}`);
    console.log(`Matching Categories: ${comparison.matching_categories}`);
    console.log(`Matching Clues: ${comparison.matching_clues}`);
    console.log(`\n✓ Data Accuracy: ${comparison.accuracy}%\n`);

    if (comparison.mismatches.length > 0 && comparison.mismatches.length <= 10) {
      console.log('Mismatches:');
      comparison.mismatches.forEach(mismatch => {
        console.log(`  ⚠️  ${mismatch}`);
      });
      console.log();
    } else if (comparison.mismatches.length > 10) {
      console.log(`⚠️  ${comparison.mismatches.length} mismatches detected\n`);
    }

    console.log('═'.repeat(70) + '\n');
  }
}

// Export for use in other modules
module.exports = JeopardyImageAnalyzer;

// CLI usage
if (require.main === module) {
  const imagePath = process.argv[2];
  
  if (!imagePath) {
    console.log('Usage: node image_analyzer.js <image_path>');
    console.log('\nExample: node image_analyzer.js ./jeopardy_game.png');
    process.exit(1);
  }

  const analyzer = new JeopardyImageAnalyzer();
  analyzer.analyzeImage(imagePath).then(analysis => {
    if (analysis) {
      analyzer.reportAnalysis(analysis, imagePath);
    }
  });
}
