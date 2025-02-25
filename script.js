// Canvas setup
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const width = canvas.width;
const height = canvas.height;

// Game elements
const paddleWidth = 15;
const paddleHeight = 80;
const ballSize = 10;
const winningScore = 5;

// Game state
let gameStarted = false;
let gameOver = false;
let playerScore = 0;
let opponentScore = 0;
let ballSpeed = 5;
let isMultiplayer = false;
let isHost = false;
let roomId = null;
let playerRole = null; // 'left' or 'right'

// Socket.io connection
let socket = null;

// Time variables for frame-independent movement
let lastTime = 0;
const FPS = 60;
const frameTime = 1000 / FPS; // Target time between frames in ms

// Visual effects
const particles = [];
const maxParticles = 40;
const trails = [];
const maxTrails = 10;
let scoreFlash = { active: false, alpha: 0, side: null };

// Colors (matching CSS variables)
const colors = {
    primary: '#00bcd4',
    secondary: '#ff4081',
    background: '#0a0a0a'
};

// Player paddle
const player = {
    x: 10,
    y: height / 2 - paddleHeight / 2,
    width: paddleWidth,
    height: paddleHeight,
    color: colors.primary,
    score: 0,
    speed: 8,
    dy: 0
};

// Opponent paddle (was computer)
const opponent = {
    x: width - paddleWidth - 10,
    y: height / 2 - paddleHeight / 2,
    width: paddleWidth,
    height: paddleHeight,
    color: colors.secondary,
    score: 0,
    speed: 4.5
};

// Ball
const ball = {
    x: width / 2,
    y: height / 2,
    size: ballSize,
    speed: ballSpeed,
    velocityX: 5,
    velocityY: 5,
    color: '#ffffff',
    glow: 20  // Glow radius
};

// DOM elements
const playerScoreElem = document.getElementById('player-score');
const computerScoreElem = document.getElementById('computer-score');
const startBtn = document.getElementById('start-btn');
const restartBtn = document.getElementById('restart-btn');

// Multiplayer UI elements
const multiplayerUI = document.createElement('div');
multiplayerUI.className = 'multiplayer-ui';
multiplayerUI.innerHTML = `
    <div class="multiplayer-menu">
        <h3>Play Online</h3>
        <div class="input-group">
            <input type="text" id="room-id" placeholder="Room Code" maxlength="6">
            <div class="buttons">
                <button id="create-btn">Create Room</button>
                <button id="join-btn">Join Room</button>
            </div>
        </div>
        <div id="room-status"></div>
        <button id="single-player-btn">Back to Single Player</button>
    </div>
`;
document.querySelector('.container').appendChild(multiplayerUI);

// Get multiplayer UI elements
const roomIdInput = document.getElementById('room-id');
const createRoomBtn = document.getElementById('create-btn');
const joinRoomBtn = document.getElementById('join-btn');
const roomStatus = document.getElementById('room-status');
const singlePlayerBtn = document.getElementById('single-player-btn');

// Add multiplayer button to main controls
const multiplayerBtn = document.createElement('button');
multiplayerBtn.id = 'multiplayer-btn';
multiplayerBtn.innerHTML = '<i class="fas fa-users"></i> Play Online';
document.querySelector('.controls').appendChild(multiplayerBtn);

// Hide multiplayer UI initially
multiplayerUI.style.display = 'none';

// Input handling
let keys = {};
let mouseY = 0;
let useMouseControl = true;

// Event listeners
document.addEventListener('keydown', (e) => {
    keys[e.key] = true;
    useMouseControl = false;
});

document.addEventListener('keyup', (e) => {
    keys[e.key] = false;
});

canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    mouseY = e.clientY - rect.top;
    useMouseControl = true;
});

startBtn.addEventListener('click', startGame);
restartBtn.addEventListener('click', restartGame);
multiplayerBtn.addEventListener('click', showMultiplayerUI);
singlePlayerBtn.addEventListener('click', showSinglePlayerUI);
createRoomBtn.addEventListener('click', createRoom);
joinRoomBtn.addEventListener('click', joinRoom);

// Socket.IO connection
function initializeSocketConnection() {
    if (socket) return; // Already connected
    
    // Add connection status UI
    const statusElem = document.createElement('div');
    statusElem.id = 'connection-status';
    statusElem.className = 'connecting';
    statusElem.textContent = 'Connecting...';
    document.querySelector('.container').appendChild(statusElem);
    
    // Connect to server - works with both local and remote servers
    try {
        const serverURL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
            ? window.location.origin
            : window.location.hostname.includes('glitch.me') 
                ? window.location.origin
                : 'https://your-render-app-name.onrender.com'; // Replace with your actual deployed URL
        
        console.log('Connecting to server:', serverURL);
        
        // Connect with retry logic and timeout
        socket = io(serverURL, {
            reconnectionAttempts: 5,
            timeout: 10000,
            transports: ['websocket', 'polling']
        });
        
        // Handle connection events
        socket.on('connect', () => {
            console.log('Connected to server with ID:', socket.id);
            statusElem.className = 'connected';
            statusElem.textContent = 'Connected';
            setTimeout(() => {
                statusElem.style.opacity = '0';
            }, 2000);
        });
        
        socket.on('connect_error', (error) => {
            console.error('Connection error:', error);
            statusElem.className = 'error';
            statusElem.textContent = 'Connection failed. Check console for details.';
            
            // Show more detailed error in room status
            updateRoomStatus('Connection to server failed. Try refreshing the page.', 'error');
        });
        
        socket.on('disconnect', (reason) => {
            console.log('Disconnected:', reason);
            statusElem.className = 'error';
            statusElem.textContent = 'Disconnected: ' + reason;
            statusElem.style.opacity = '1';
            
            // If still in a game, show alert
            if (isMultiplayer) {
                updateRoomStatus('Lost connection to server. Try refreshing.', 'error');
            }
        });
        
        socket.on('connectionEstablished', (data) => {
            console.log('Server confirmed connection:', data);
        });
        
        // Rest of socket event handlers remain the same
        socket.on('roomCreated', (id) => {
            roomId = id;
            isHost = true;
            playerRole = 'left';
            updateRoomStatus(`Room created! Share code: ${roomId}`, 'success');
        });
        
        socket.on('roomJoined', (id) => {
            roomId = id;
            isHost = false;
            updateRoomStatus(`Joined room: ${roomId}`, 'success');
        });
        
        socket.on('roomError', (message) => {
            updateRoomStatus(message, 'error');
        });
        
        socket.on('playerJoined', (players) => {
            if (players.length === 2) {
                updateRoomStatus('Game ready! Both players connected.', 'success');
            }
        });
        
        socket.on('gameReady', (roles) => {
            isMultiplayer = true;
            playerRole = roles[socket.id];
            
            // Set player position based on role
            if (playerRole === 'right') {
                player.x = width - paddleWidth - 10;
                player.color = colors.secondary;
                opponent.x = 10;
                opponent.color = colors.primary;
            }
            
            if (isHost) {
                startMultiplayerGame();
            } else {
                // Wait for host to start
                gameStarted = true;
                updateRoomStatus('Game started!', 'success');
                multiplayerUI.style.display = 'none';
            }
        });
        
        socket.on('opponentMove', (position) => {
            opponent.y = position;
        });
        
        socket.on('ballSync', (ballData) => {
            if (!isHost) {
                ball.x = ballData.x;
                ball.y = ballData.y;
                ball.velocityX = ballData.velocityX;
                ball.velocityY = ballData.velocityY;
            }
        });
        
        socket.on('scoreSync', (data) => {
            playerScore = data.playerScore;
            opponentScore = data.opponentScore;
            updateScore();
        });
        
        socket.on('playerLeft', () => {
            if (isMultiplayer) {
                updateRoomStatus('Opponent disconnected', 'error');
                resetToSinglePlayer();
            }
        });
    } catch (error) {
        console.error('Socket initialization error:', error);
        const statusElem = document.getElementById('connection-status');
        if (statusElem) {
            statusElem.className = 'error';
            statusElem.textContent = 'Failed to connect to server';
        }
    }
}

// Multiplayer UI functions
function showMultiplayerUI() {
    multiplayerUI.style.display = 'block';
    initializeSocketConnection();
}

function showSinglePlayerUI() {
    multiplayerUI.style.display = 'none';
    resetToSinglePlayer();
}

function updateRoomStatus(message, type) {
    roomStatus.textContent = message;
    roomStatus.className = `status ${type}`;
    
    // If it's a success message with a room code, add copy button
    if (type === 'success' && message.includes('Room created')) {
        const code = roomId;
        roomStatus.textContent = 'Room created! Share code: ';
        
        const codeSpan = document.createElement('span');
        codeSpan.className = 'room-code';
        codeSpan.textContent = code;
        roomStatus.appendChild(codeSpan);
        
        const copyBtn = document.createElement('button');
        copyBtn.className = 'copy-btn';
        copyBtn.innerHTML = '<i class="fas fa-copy"></i>';
        copyBtn.addEventListener('click', () => {
            navigator.clipboard.writeText(code)
                .then(() => {
                    copyBtn.innerHTML = '<i class="fas fa-check"></i>';
                    setTimeout(() => {
                        copyBtn.innerHTML = '<i class="fas fa-copy"></i>';
                    }, 2000);
                })
                .catch(err => {
                    console.error('Could not copy text: ', err);
                    copyBtn.innerHTML = '<i class="fas fa-times"></i>';
                    setTimeout(() => {
                        copyBtn.innerHTML = '<i class="fas fa-copy"></i>';
                    }, 2000);
                });
        });
        roomStatus.appendChild(copyBtn);
    }
}

function createRoom() {
    if (!socket || !socket.connected) {
        updateRoomStatus('Not connected to server. Please wait or refresh.', 'error');
        return;
    }
    
    const id = roomIdInput.value.trim() || generateRoomId();
    roomIdInput.value = id;
    socket.emit('createRoom', id);
}

function joinRoom() {
    if (!socket || !socket.connected) {
        updateRoomStatus('Not connected to server. Please wait or refresh.', 'error');
        return;
    }
    
    const id = roomIdInput.value.trim();
    if (!id) {
        updateRoomStatus('Please enter a room code', 'error');
        return;
    }
    socket.emit('joinRoom', id);
}

function generateRoomId() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function startMultiplayerGame() {
    gameStarted = true;
    gameOver = false;
    playerScore = 0;
    opponentScore = 0;
    updateScore();
    resetBall();
    lastTime = performance.now();
    multiplayerUI.style.display = 'none';
    gameLoop(lastTime);
}

function resetToSinglePlayer() {
    isMultiplayer = false;
    isHost = false;
    roomId = null;
    playerRole = null;
    
    // Reset paddle positions
    player.x = 10;
    player.color = colors.primary;
    opponent.x = width - paddleWidth - 10;
    opponent.color = colors.secondary;
    
    // Reset game
    gameStarted = false;
    gameOver = false;
    playerScore = 0;
    opponentScore = 0;
    updateScore();
    resetBall();
    
    // Reset UI
    multiplayerUI.style.display = 'none';
}

// Game functions
function startGame() {
    if (!gameStarted) {
        gameStarted = true;
        lastTime = performance.now();
        gameLoop(lastTime);
    }
}

function restartGame() {
    // Reset game state
    gameStarted = false;
    gameOver = false;
    playerScore = 0;
    opponentScore = 0;
    updateScore();
    
    // Reset elements positions
    player.y = height / 2 - player.height / 2;
    opponent.y = height / 2 - opponent.height / 2;
    resetBall();
    
    // Clear effects
    particles.length = 0;
    trails.length = 0;
    
    // Redraw everything
    draw();
}

function resetBall() {
    ball.x = width / 2;
    ball.y = height / 2;
    ball.speed = ballSpeed;
    
    // Randomize initial direction
    ball.velocityX = Math.random() > 0.5 ? -ball.speed : ball.speed;
    ball.velocityY = Math.random() * 10 - 5; // Random Y direction
    
    // Clear trailing effect
    trails.length = 0;
}

function updateScore() {
    playerScoreElem.textContent = playerScore;
    computerScoreElem.textContent = opponentScore;
    
    // In multiplayer, update opponent's score too
    if (isMultiplayer) {
        socket.emit('scoreUpdate', {
            roomId,
            playerScore,
            opponentScore
        });
    }
}

function collision(ball, paddle) {
    return (
        ball.x < paddle.x + paddle.width &&
        ball.x + ball.size > paddle.x &&
        ball.y < paddle.y + paddle.height &&
        ball.y + ball.size > paddle.y
    );
}

function movePlayer(deltaTime) {
    player.dy = 0;
    
    if (useMouseControl) {
        // Mouse control
        // Calculate center of paddle
        const paddleCenter = player.y + player.height / 2;
        // Move towards the mouse with a dead zone
        if (Math.abs(mouseY - paddleCenter) > 10) {
            player.dy = mouseY > paddleCenter ? player.speed : -player.speed;
        }
    } else {
        // Keyboard control
        if (keys['ArrowUp'] || keys['w']) {
            player.dy = -player.speed;
        }
        if (keys['ArrowDown'] || keys['s']) {
            player.dy = player.speed;
        }
    }
    
    // Apply time-based movement
    player.y += player.dy * (deltaTime / frameTime);
    
    // Keep paddle within canvas boundaries
    if (player.y < 0) {
        player.y = 0;
    } else if (player.y + player.height > height) {
        player.y = height - player.height;
    }
    
    // In multiplayer, send our position to the opponent
    if (isMultiplayer) {
        socket.emit('paddleMove', {
            roomId,
            position: player.y
        });
    }
}

function moveOpponent(deltaTime) {
    if (isMultiplayer) {
        // In multiplayer, opponent's position is updated via socket events
        return;
    }
    
    // AI movement (for single player)
    const opponentCenter = opponent.y + opponent.height / 2;
    const ballCenter = ball.y + ball.size / 2;
    
    // Only move if the ball is coming towards the opponent
    if (ball.velocityX > 0) {
        // Add a slight delay to make it beatable
        if (opponentCenter < ballCenter - 15) {
            opponent.y += opponent.speed * (deltaTime / frameTime);
        } else if (opponentCenter > ballCenter + 15) {
            opponent.y -= opponent.speed * (deltaTime / frameTime);
        }
    }
    
    // Keep paddle within canvas boundaries
    if (opponent.y < 0) {
        opponent.y = 0;
    } else if (opponent.y + opponent.height > height) {
        opponent.y = height - opponent.height;
    }
}

function moveBall(deltaTime) {
    // In multiplayer, only the host moves the ball to keep game synced
    if (isMultiplayer && !isHost) return;
    
    // Store previous position for trail effect
    if (trails.length >= maxTrails) {
        trails.shift();
    }
    trails.push({ x: ball.x, y: ball.y });
    
    // Apply time-based movement
    ball.x += ball.velocityX * (deltaTime / frameTime);
    ball.y += ball.velocityY * (deltaTime / frameTime);
    
    // Wall collision (top and bottom)
    if (ball.y <= 0 || ball.y + ball.size >= height) {
        ball.velocityY = -ball.velocityY;
        // Add particles effect
        createParticles(ball.x, ball.y <= 0 ? 0 : height, 10, '#ffffff');
    }
    
    // Determine which paddle to check based on ball direction
    const ballGoingLeft = ball.velocityX < 0;
    const paddleToCheck = ballGoingLeft ? 
        (playerRole === 'left' ? player : opponent) : 
        (playerRole === 'left' ? opponent : player);
    
    // Paddle collision
    if (collision(ball, paddleToCheck)) {
        // Reverse ball direction
        ball.velocityX = -ball.velocityX * 1.05; // Increase speed slightly
        
        // Change Y direction based on where the ball hit the paddle
        const hitLocation = (ball.y + ball.size/2) - (paddleToCheck.y + paddleToCheck.height/2);
        ball.velocityY = hitLocation * 0.2;
        
        // Add particles
        createParticles(
            paddleToCheck === player ? player.x + player.width : opponent.x,
            ball.y, 
            15, 
            paddleToCheck.color
        );
    }
    
    // Ball goes out of bounds - Score!
    if (ball.x < 0) {
        // Right player scores
        if (playerRole === 'right') {
            playerScore++;
        } else {
            opponentScore++;
        }
        
        updateScore();
        
        // Scoring effects
        createParticles(0, ball.y, 30, opponent.color);
        scoreFlash = { active: true, alpha: 1, side: 'right' };
        
        checkGameOver();
        resetBall();
    } else if (ball.x > width) {
        // Left player scores
        if (playerRole === 'left') {
            playerScore++;
        } else {
            opponentScore++;
        }
        
        updateScore();
        
        // Scoring effects
        createParticles(width, ball.y, 30, player.color);
        scoreFlash = { active: true, alpha: 1, side: 'left' };
        
        checkGameOver();
        resetBall();
    }
    
    // In multiplayer, send ball data to the opponent
    if (isMultiplayer && isHost) {
        socket.emit('ballUpdate', {
            roomId,
            ballData: {
                x: ball.x,
                y: ball.y,
                velocityX: ball.velocityX,
                velocityY: ball.velocityY
            }
        });
    }
}

function checkGameOver() {
    if (playerScore >= winningScore || opponentScore >= winningScore) {
        gameOver = true;
        gameStarted = false;
        
        // Victory particles burst
        const color = playerScore >= winningScore ? player.color : opponent.color;
        createParticles(width/2, height/2, 100, color);
    }
}

// Particle system for visual effects
function createParticles(x, y, count, color) {
    for (let i = 0; i < count; i++) {
        if (particles.length >= maxParticles) {
            particles.shift();
        }
        
        particles.push({
            x: x,
            y: y,
            size: Math.random() * 4 + 1,
            speedX: (Math.random() - 0.5) * 8,
            speedY: (Math.random() - 0.5) * 8,
            color: color,
            alpha: 1
        });
    }
}

function updateParticles(deltaTime) {
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        
        p.x += p.speedX * (deltaTime / frameTime);
        p.y += p.speedY * (deltaTime / frameTime);
        p.alpha -= 0.02 * (deltaTime / frameTime);
        
        if (p.alpha <= 0) {
            particles.splice(i, 1);
        }
    }
    
    // Update score flash effect
    if (scoreFlash.active) {
        scoreFlash.alpha -= 0.04 * (deltaTime / frameTime);
        if (scoreFlash.alpha <= 0) {
            scoreFlash.active = false;
        }
    }
}

function draw() {
    // Clear canvas
    ctx.fillStyle = colors.background;
    ctx.fillRect(0, 0, width, height);
    
    // Draw score flash
    if (scoreFlash.active) {
        ctx.fillStyle = scoreFlash.side === 'left' ? 
            `rgba(${hexToRgb(colors.primary)}, ${scoreFlash.alpha * 0.2})` :
            `rgba(${hexToRgb(colors.secondary)}, ${scoreFlash.alpha * 0.2})`;
        ctx.fillRect(0, 0, width, height);
    }
    
    // Draw center line
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.setLineDash([10, 15]);
    ctx.beginPath();
    ctx.moveTo(width / 2, 0);
    ctx.lineTo(width / 2, height);
    ctx.stroke();
    ctx.setLineDash([]);
    
    // Draw trails
    for (let i = 0; i < trails.length; i++) {
        const trail = trails[i];
        const alpha = i / trails.length * 0.5;
        ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
        const size = (ball.size / 2) * (i / trails.length);
        ctx.beginPath();
        ctx.arc(trail.x + ball.size / 2, trail.y + ball.size / 2, size, 0, Math.PI * 2);
        ctx.fill();
    }
    
    // Draw particles
    for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.globalAlpha = 1;
    
    // Draw player paddle with glow
    drawPaddleWithGlow(player);
    
    // Draw opponent paddle with glow
    drawPaddleWithGlow(opponent);
    
    // Draw ball with glow
    drawBallWithGlow();
    
    // Draw game status
    if (!gameStarted && !gameOver) {
        drawGameMessage("Press 'Start Game' to play", width / 2, height / 2, '20px');
    } else if (gameOver) {
        const message = playerScore >= winningScore ? "You Win!" : "Opponent Wins!";
        drawGameMessage(message, width / 2, height / 2, '30px');
        drawGameMessage("Press 'Restart' to play again", width / 2, height / 2 + 40, '20px');
    }
}

function drawPaddleWithGlow(paddle) {
    // Draw glow
    const gradient = ctx.createRadialGradient(
        paddle.x + paddle.width/2, paddle.y + paddle.height/2, 5,
        paddle.x + paddle.width/2, paddle.y + paddle.height/2, 50
    );
    gradient.addColorStop(0, paddle.color);
    gradient.addColorStop(1, 'rgba(0,0,0,0)');
    
    ctx.save();
    ctx.globalAlpha = 0.2;
    ctx.fillStyle = gradient;
    ctx.fillRect(paddle.x - 20, paddle.y - 20, paddle.width + 40, paddle.height + 40);
    ctx.restore();
    
    // Draw paddle
    ctx.fillStyle = paddle.color;
    ctx.shadowColor = paddle.color;
    ctx.shadowBlur = 15;
    ctx.fillRect(paddle.x, paddle.y, paddle.width, paddle.height);
    ctx.shadowBlur = 0;
}

function drawBallWithGlow() {
    // Draw ball glow
    const gradient = ctx.createRadialGradient(
        ball.x + ball.size/2, ball.y + ball.size/2, 0,
        ball.x + ball.size/2, ball.y + ball.size/2, ball.glow
    );
    gradient.addColorStop(0, 'rgba(255, 255, 255, 0.8)');
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
    
    ctx.beginPath();
    ctx.fillStyle = gradient;
    ctx.arc(ball.x + ball.size/2, ball.y + ball.size/2, ball.glow, 0, Math.PI * 2);
    ctx.fill();
    
    // Draw actual ball
    ctx.fillStyle = ball.color;
    ctx.shadowColor = 'white';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(ball.x + ball.size/2, ball.y + ball.size/2, ball.size/2, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
}

function drawGameMessage(text, x, y, fontSize = '20px') {
    // Draw glowing text
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.font = `${fontSize} Poppins, sans-serif`;
    ctx.textAlign = 'center';
    ctx.shadowColor = colors.primary;
    ctx.shadowBlur = 10;
    ctx.fillText(text, x, y);
    ctx.shadowBlur = 0;
}

function hexToRgb(hex) {
    // Remove # if present
    hex = hex.replace('#', '');
    
    // Parse the hex value
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    
    return `${r}, ${g}, ${b}`;
}

function gameLoop(currentTime) {
    if (!gameStarted) return;
    
    // Calculate time since last frame
    const deltaTime = currentTime - lastTime;
    lastTime = currentTime;
    
    movePlayer(deltaTime);
    moveOpponent(deltaTime);
    
    if (!gameOver) {
        moveBall(deltaTime);
    }
    
    updateParticles(deltaTime);
    draw();
    
    // Continue the game loop
    requestAnimationFrame(gameLoop);
}

// Initial draw
draw(); 