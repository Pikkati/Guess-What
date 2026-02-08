const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const db = require('./db');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));

// Load questions from database
let questions = [];
db.all("SELECT category, value, question, answer FROM questions", (err, rows) => {
  if (err) {
    console.error('Error loading questions:', err);
  } else {
    questions = rows;
    console.log(`Loaded ${questions.length} questions from database`);
  }
});

let games = {};
let waitingPlayers = [];

io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  // Player joins waiting queue
  socket.on('joinGame', (playerName) => {
    socket.playerName = playerName;
    waitingPlayers.push(socket);

    if (waitingPlayers.length >= 2) {
      // Start a new game with two players
      const player1 = waitingPlayers.shift();
      const player2 = waitingPlayers.shift();

      const gameId = Date.now().toString();
      games[gameId] = {
        id: gameId,
        players: [
          { id: player1.id, name: player1.playerName, score: 0 },
          { id: player2.id, name: player2.playerName, score: 0 }
        ],
        currentPlayer: 0,
        board: createBoard(),
        gameState: 'waiting', // waiting, playing, finished
        round: 1,
        maxRounds: 2
      };

      player1.join(gameId);
      player2.join(gameId);

      io.to(gameId).emit('gameStarted', games[gameId]);
      games[gameId].gameState = 'playing';
    } else {
      socket.emit('waitingForOpponent');
    }
  });

  // Player selects a question
  socket.on('selectQuestion', (data) => {
    const { gameId, category, value } = data;
    const game = games[gameId];
    if (!game || game.gameState !== 'playing') return;

    const currentPlayer = game.players[game.currentPlayer];
    if (socket.id !== currentPlayer.id) return;

    const question = game.board[category].find(q => q.value === value && !q.answered);
    if (!question) return;

    question.answered = true;
    io.to(gameId).emit('questionSelected', { question, currentPlayer: currentPlayer.name });
  });

  // Player submits answer
  socket.on('submitAnswer', (data) => {
    const { gameId, answer } = data;
    const game = games[gameId];
    if (!game || game.gameState !== 'playing') return;

    const currentPlayer = game.players[game.currentPlayer];
    if (socket.id !== currentPlayer.id) return;

    const question = game.currentQuestion;
    const isCorrect = answer.toLowerCase().trim() === question.answer.toLowerCase().trim();

    if (isCorrect) {
      currentPlayer.score += question.value;
    } else {
      currentPlayer.score -= question.value;
    }

    io.to(gameId).emit('answerResult', {
      isCorrect,
      correctAnswer: question.answer,
      player: currentPlayer.name,
      newScore: currentPlayer.score
    });

    // Switch to next player
    game.currentPlayer = (game.currentPlayer + 1) % 2;

    // Check if round is complete
    const allAnswered = Object.values(game.board).every(cat =>
      cat.every(q => q.answered)
    );

    if (allAnswered) {
      if (game.round < game.maxRounds) {
        game.round++;
        game.board = createBoard();
        io.to(gameId).emit('newRound', game);
      } else {
        game.gameState = 'finished';
        const winner = game.players[0].score > game.players[1].score ? game.players[0] :
                      game.players[1].score > game.players[0].score ? game.players[1] : null;
        io.to(gameId).emit('gameFinished', { winner, finalScores: game.players });
      }
    } else {
      io.to(gameId).emit('nextTurn', { currentPlayer: game.players[game.currentPlayer].name });
    }
  });

  // Player submits feedback
  socket.on('submitFeedback', (data) => {
    const { gameId, feedback } = data;
    console.log(`Feedback from game ${gameId}:`, feedback);
    // In a real app, save to database
    io.to(gameId).emit('feedbackReceived', 'Thank you for your feedback!');
  });

  // Chat message
  socket.on('chatMessage', (message) => {
    const gameId = Object.keys(games).find(id => games[id].players.some(p => p.id === socket.id));
    if (gameId) {
      const player = games[gameId].players.find(p => p.id === socket.id);
      io.to(gameId).emit('chatMessage', { player: player.name, message });
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    // Remove from waiting players
    waitingPlayers = waitingPlayers.filter(player => player.id !== socket.id);

    // Handle game cleanup if needed
    for (const gameId in games) {
      const game = games[gameId];
      const playerIndex = game.players.findIndex(p => p.id === socket.id);
      if (playerIndex !== -1) {
        game.gameState = 'finished';
        io.to(gameId).emit('playerDisconnected', { disconnectedPlayer: game.players[playerIndex].name });
        delete games[gameId];
      }
    }
  });
});

function createBoard() {
  const categories = [...new Set(questions.map(q => q.category))].slice(0, 6); // Take first 6 categories
  const board = {};

  categories.forEach(category => {
    board[category] = questions
      .filter(q => q.category === category)
      .slice(0, 5) // Take up to 5 questions per category
      .map(q => ({ ...q, answered: false }));
  });

  return board;
}

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});