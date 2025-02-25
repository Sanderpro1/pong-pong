# Multiplayer Ping Pong Game

A modern, online multiplayer ping pong game with beautiful visuals and real-time gameplay.

![Ping Pong Game](https://i.imgur.com/example.png)

## Features

- Single player mode against AI opponent
- Online multiplayer to play against friends
- Beautiful modern design with particle effects and animations
- Consistent gameplay speed regardless of monitor refresh rate
- Mobile-responsive design

## Setup

### Prerequisites
- Node.js (v14 or higher)
- NPM (v6 or higher)

### Installation

1. Clone or download this repository
2. Open a terminal in the project folder
3. Install dependencies:
   ```
   npm install
   ```
4. Start the server:
   ```
   npm start
   ```
5. Open your browser and go to:
   ```
   http://localhost:3000
   ```

## How to Play

### Single Player Mode
1. When you first load the game, you're in single player mode
2. Click "Start Game" to begin playing against the AI
3. Control your paddle using your mouse or keyboard (arrow keys or W/S keys)
4. First to score 5 points wins!

### Multiplayer Mode
1. Click the "Play Online" button
2. Either:
   - Create a new room (a room code will be generated)
   - Join an existing room (enter the room code your friend shared)
3. Share the room code with your friend
4. Once your friend joins, the game will start automatically
5. The player who created the room controls the left paddle, the joining player controls the right paddle

## Controls

- **Mouse:** Move mouse up/down to control paddle
- **Keyboard:** Use up/down arrow keys or W/S keys
- **Start:** Click "Start Game" button
- **Restart:** Click "Restart" button
- **Play Online:** Click "Play Online" button
- **Go Back to Single Player:** Click "Back to Single Player" button

## Tech Stack

- HTML5 Canvas for game rendering
- CSS3 for styling
- JavaScript for game logic
- Socket.IO for real-time multiplayer functionality
- Node.js & Express for the server

## Troubleshooting

- **Can't connect to multiplayer:** Make sure the server is running and you're connected to the internet
- **Game is too fast/slow:** The game is designed to run at a consistent speed regardless of monitor refresh rate
- **Room code doesn't work:** Make sure you're entering the exact code, including any uppercase/lowercase letters

## License

This project is open source and available under the MIT License. 