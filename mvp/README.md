# Guess What MVP - Trivia Training Game

This is a minimal viable product (MVP) for the Guess What trivia training platform. It allows two players to compete in a simplified trivia-style game with basic features.

## Features

- **Two-player multiplayer**: Real-time gameplay between two players
- **Trivia-style board**: 6 categories with 2 questions each ($200 and $400)
- **Turn-based gameplay**: Players alternate turns
- **Scoring system**: Correct answers add points, incorrect answers deduct points
- **Two rounds**: Game consists of two rounds with fresh boards
- **Private chat**: Players can communicate during the game
- **Feedback system**: Players can submit feedback after the game

## How to Run

1. Make sure you have Node.js installed
2. Navigate to the `mvp` directory
3. Run `npm install` to install dependencies
4. Run `npm start` to start the server
5. Open your browser and go to `http://localhost:3001`

## Gameplay

1. Enter your name and click "Join Game"
2. Wait for another player to join
3. Once matched, the game starts
4. Click on a question value to select it
5. Answer the question in the text box
6. If correct, you gain points; if incorrect, you lose points
7. Play continues until all questions are answered in both rounds
8. After the game, submit feedback

## Technical Details

- **Backend**: Node.js with Express and Socket.io for real-time communication
- **Frontend**: Vanilla HTML, CSS, and JavaScript
- **Database**: In-memory storage (questions stored in code)
- **Real-time**: WebSocket connections for multiplayer functionality

## Limitations

- Only supports exactly 2 players per game
- Questions are hardcoded (12 total)
- No user accounts or persistence
- No AI opponents
- Basic UI without advanced styling
- No tournament system
- Feedback is logged to console only

## Next Steps

This MVP serves as a foundation for the full platform. Future enhancements include:

- User registration and authentication
- Expanded question database
- AI opponents
- Tournament system
- Advanced UI/UX
- Mobile responsiveness
- Analytics and performance tracking

## Feedback

After playing, please use the feedback form to share your thoughts on gameplay, UI, and suggestions for improvement.