# Multiplayer Ping Pong Game

A modern, online multiplayer ping pong game with beautiful visuals and real-time gameplay.

![Ping Pong Game](https://i.imgur.com/example.png)

## Features

- Single player mode against AI opponent
- Online multiplayer to play against friends
- Beautiful modern design with particle effects and animations
- Consistent gameplay speed regardless of monitor refresh rate
- Mobile-responsive design

## Play Online Now!

The easiest way to play is to use one of these already-deployed versions:

1. **Render**: [https://ping-pong-multiplayer.onrender.com](https://ping-pong-multiplayer.onrender.com) (May take ~30 seconds to wake up if inactive)
2. **Glitch**: [https://ping-pong-multiplayer.glitch.me](https://ping-pong-multiplayer.glitch.me) (Faster startup)

Or deploy your own version by following the instructions below.

## Deployment Options

### Option 1: Deploy to Glitch (Easiest)

1. Go to [glitch.com](https://glitch.com) and create an account
2. Click "New Project" → "Import from GitHub"
3. Enter the repository URL: `https://github.com/yourusername/your-repo-name`
4. Glitch will automatically start your server
5. Share the provided URL with friends

### Option 2: Deploy to Render (More Reliable)

1. Go to [render.com](https://render.com) and create an account
2. Click "New +" → "Web Service"
3. Connect to your GitHub repo or click "Deploy from Blueprint" and enter the repo URL
4. Render will detect the `render.yaml` configuration and deploy automatically
5. Once deployed, share the provided URL with friends

### Option 3: Local Setup

If you prefer to run it locally:

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

## How to Play Online

1. Visit the game URL
2. Click "Play Online"
3. You have two options:
   - **Create a room**: A room code is generated
   - **Join a room**: Enter a code shared by a friend
4. Share your room code with your friend (use the copy button)
5. Once they join, the game starts automatically
6. The player who created the room controls the left paddle
7. The joining player controls the right paddle

## Troubleshooting Online Play

If online play isn't working:

1. **Check Connection Status**: Look for the connection indicator in the top-right corner
2. **Server Issues**: 
   - Free hosting can sometimes be slow to start (wait 30-60 seconds)
   - Free services may go to sleep after periods of inactivity
3. **Network Problems**:
   - Some networks (school/office) block WebSocket connections
   - Try using a mobile hotspot or different network
4. **Room Codes**:
   - Make sure you're entering the exact code (case-sensitive)
   - If a room doesn't work, try creating a new one
5. **Browser Compatibility**:
   - Use Chrome, Edge, or Firefox for best results
   - Safari may have WebSocket limitations

## Controls

- **Mouse**: Move mouse up/down to control paddle
- **Keyboard**: Use up/down arrow keys or W/S keys
- **Start**: Click "Start Game" button
- **Restart**: Click "Restart" button
- **Play Online**: Click "Play Online" button

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