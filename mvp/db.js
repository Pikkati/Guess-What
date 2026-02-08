const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./jeopardy.db');

// Create table if it doesn't exist
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS questions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category TEXT,
    value INTEGER,
    question TEXT,
    answer TEXT
  )`);

  // Insert sample questions from research and originals
  const stmt = db.prepare("INSERT OR IGNORE INTO questions (category, value, question, answer) VALUES (?, ?, ?, ?)");

  // Original questions
  stmt.run("History", 200, "Who was the first President of the United States?", "What is George Washington?");
  stmt.run("History", 400, "In which year did World War II end?", "What is 1945?");
  stmt.run("Science", 200, "What is the chemical symbol for water?", "What is H2O?");
  stmt.run("Science", 400, "What planet is known as the Red Planet?", "What is Mars?");
  stmt.run("Literature", 200, "Who wrote \"To Kill a Mockingbird\"?", "Who is Harper Lee?");
  stmt.run("Literature", 400, "What is the name of the first book in the Harry Potter series?", "What is Harry Potter and the Philosopher's Stone?");
  stmt.run("Sports", 200, "How many players are on a basketball team on the court at once?", "What is 5?");
  stmt.run("Sports", 400, "In which sport would you perform a slam dunk?", "What is Basketball?");
  stmt.run("Geography", 200, "What is the capital of France?", "What is Paris?");
  stmt.run("Geography", 400, "Which is the longest river in the world?", "What is the Nile River?");
  stmt.run("Entertainment", 200, "Who played Jack Sparrow in Pirates of the Caribbean?", "Who is Johnny Depp?");
  stmt.run("Entertainment", 400, "What is the highest-grossing film of all time?", "What is Avatar?");

  // From J! Archive examples
  stmt.run("PORTS OF CALL", 200, "You can take a water taxi from Marco Polo Airport to the cruise terminals at this city's port", "What is Venice?");
  stmt.run("NONFICTION", 200, "\"We the People\" is Jill Lepore's history of this document", "What is the U.S. Constitution?");
  stmt.run("MODERN TECH", 200, "The original limit for a tweet on Twitter was this many characters", "What is 140?");
  stmt.run("ART & ARTISTS", 0, "He entered the priory of San Marco in Florence in the 1430s & was commissioned to paint its altarpiece by the Medicis", "Who is Fra Angelico?");
  stmt.run("CREATURES FROM MYTH", 400, "Hercules' 12th labor involved this beast that had 3 heads per Apollodorus (but 50 according to Hesiod)", "What is Cerberus?");
  stmt.run("FRANCE IN THE 1600s", 400, "Assassinated in 1610, Henry IV of Navarre had brought peace & prosperity to France as the first king of this dynasty", "What is Bourbon?");

  stmt.finalize();
});

module.exports = db;