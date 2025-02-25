// Canvas setup
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const width = canvas.width;
const height = canvas.height;

// Sound effects
const sounds = {
    paddle: new Audio('https://assets.codepen.io/21542/pop.wav'),
    score: new Audio('https://assets.codepen.io/21542/score.wav'),
    wall: new Audio('https://assets.codepen.io/21542/wall.wav'),
    gameStart: new Audio('https://assets.codepen.io/21542/start-game.wav'),
    powerup: new Audio('https://assets.codepen.io/21542/powerup.wav')
};

// Mute all sounds initially (will be enabled by user interaction)
Object.values(sounds).forEach(sound => {
    sound.volume = 0.3;
    sound.muted = true;
});

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
let lastScoreTime = 0; // To prevent rapid scoring
let soundEnabled = false;
let countdown = null;
let powerups = [];
let settings = {
    ballSpeed: 5,
    paddleSize: 80,
    soundEnabled: false
};

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
    background: '#0a0a0a',
    powerupSpeed: '#ffc107',
    powerupSize: '#4caf50',
    powerupSlow: '#9c27b0'
};

// Power-up types
const POWERUP_TYPES = {
    SPEED_UP: 'speedUp',
    ENLARGE_PADDLE: 'enlargePaddle',
    SLOW_OPPONENT: 'slowOpponent'
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
    dy: 0,
    originalHeight: paddleHeight,
    originalSpeed: 8,
    powerups: []
};

// Opponent paddle (was computer)
const opponent = {
    x: width - paddleWidth - 10,
    y: height / 2 - paddleHeight / 2,
    width: paddleWidth,
    height: paddleHeight,
    color: colors.secondary,
    score: 0,
    speed: 4.5,
    originalHeight: paddleHeight,
    originalSpeed: 4.5,
    powerups: []
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
const leftPlayerLabel = document.getElementById('left-player-label');
const rightPlayerLabel = document.getElementById('right-player-label');
const startBtn = document.getElementById('start-btn');
const restartBtn = document.getElementById('restart-btn');

// Multiplayer UI elements
const multiplayerUI = document.createElement('div');
multiplayerUI.className = 'multiplayer-ui';
multiplayerUI.innerHTML = `
    <div class="multiplayer-menu">
        <h3>Play Online</h3>
        <div id="player-info"></div>
        <div class="input-group">
            <input type="text" id="room-id" placeholder="Room Code" maxlength="6">
            <div class="buttons">
                <button id="create-btn">Create Room</button>
                <button id="join-btn">Join Room</button>
            </div>
        </div>
        <div id="room-status"></div>
        <div id="game-options">
            <h4>Game Settings</h4>
            <div class="setting">
                <label for="ball-speed">Ball Speed:</label>
                <input type="range" id="ball-speed" min="3" max="8" value="5" step="1">
                <span id="ball-speed-value">5</span>
            </div>
            <div class="setting">
                <label for="sound-toggle">Sound:</label>
                <button id="sound-toggle">
                    <i class="fas fa-volume-mute"></i> Enable Sound
                </button>
            </div>
            <div class="setting">
                <label for="powerups-toggle">Power-ups:</label>
                <input type="checkbox" id="powerups-toggle" checked>
                <label for="powerups-toggle" class="toggle-label"></label>
            </div>
        </div>
        <button id="single-player-btn">Back to Single Player</button>
    </div>
`;
document.querySelector('.container').appendChild(multiplayerUI);

// Create a game menu for game over state
const gameOverUI = document.createElement('div');
gameOverUI.className = 'game-over-ui';
gameOverUI.innerHTML = `
    <div class="game-over-menu">
        <h3 id="game-result">You Win!</h3>
        <div class="buttons">
            <button id="rematch-btn"><i class="fas fa-redo"></i> Rematch</button>
            <button id="menu-btn"><i class="fas fa-home"></i> Main Menu</button>
        </div>
    </div>
`;
document.querySelector('.container').appendChild(gameOverUI);
gameOverUI.style.display = 'none';

// Get multiplayer UI elements
const roomIdInput = document.getElementById('room-id');
const createRoomBtn = document.getElementById('create-btn');
const joinRoomBtn = document.getElementById('join-btn');
const roomStatus = document.getElementById('room-status');
const singlePlayerBtn = document.getElementById('single-player-btn');
const playerInfo = document.getElementById('player-info');
const soundToggleBtn = document.getElementById('sound-toggle');
const powerupsToggle = document.getElementById('powerups-toggle');
const ballSpeedSlider = document.getElementById('ball-speed');
const ballSpeedValue = document.getElementById('ball-speed-value');
const rematchBtn = document.getElementById('rematch-btn');
const menuBtn = document.getElementById('menu-btn');

// Add multiplayer button to main controls
const multiplayerBtn = document.createElement('button');
multiplayerBtn.id = 'multiplayer-btn';
multiplayerBtn.innerHTML = '<i class="fas fa-users"></i> Play Online';
document.querySelector('.controls').appendChild(multiplayerBtn);

// Add settings button to main controls
const settingsBtn = document.createElement('button');
settingsBtn.id = 'settings-btn';
settingsBtn.innerHTML = '<i class="fas fa-cog"></i> Settings';
document.querySelector('.controls').appendChild(settingsBtn);

// Create settings menu
const settingsUI = document.createElement('div');
settingsUI.className = 'settings-ui';
settingsUI.innerHTML = `
    <div class="settings-menu">
        <h3>Game Settings</h3>
        <div class="setting">
            <label for="sp-ball-speed">Ball Speed:</label>
            <input type="range" id="sp-ball-speed" min="3" max="8" value="5" step="1">
            <span id="sp-ball-speed-value">5</span>
        </div>
        <div class="setting">
            <label for="sp-sound-toggle">Sound:</label>
            <button id="sp-sound-toggle">
                <i class="fas fa-volume-mute"></i> Enable Sound
            </button>
        </div>
        <div class="setting">
            <label for="sp-powerups-toggle">Power-ups:</label>
            <input type="checkbox" id="sp-powerups-toggle" checked>
            <label for="sp-powerups-toggle" class="toggle-label"></label>
        </div>
        <button id="settings-close">Close</button>
    </div>
`;
document.querySelector('.container').appendChild(settingsUI);
settingsUI.style.display = 'none';

// Get settings UI elements
const spBallSpeedSlider = document.getElementById('sp-ball-speed');
const spBallSpeedValue = document.getElementById('sp-ball-speed-value');
const spSoundToggleBtn = document.getElementById('sp-sound-toggle');
const spPowerupsToggle = document.getElementById('sp-powerups-toggle');
const settingsCloseBtn = document.getElementById('settings-close');

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

// Enable sound when the user interacts with the game
document.addEventListener('click', enableSound);

function enableSound() {
    if (!soundEnabled) {
        soundEnabled = true;
        Object.values(sounds).forEach(sound => {
            sound.muted = !settings.soundEnabled;
        });
        document.removeEventListener('click', enableSound);
    }
}

// Button event listeners
startBtn.addEventListener('click', startGame);
restartBtn.addEventListener('click', restartGame);
multiplayerBtn.addEventListener('click', showMultiplayerUI);
singlePlayerBtn.addEventListener('click', showSinglePlayerUI);
createRoomBtn.addEventListener('click', createRoom);
joinRoomBtn.addEventListener('click', joinRoom);
settingsBtn.addEventListener('click', showSettings);
settingsCloseBtn.addEventListener('click', hideSettings);

// Settings event listeners
soundToggleBtn.addEventListener('click', () => toggleSound(soundToggleBtn));
spSoundToggleBtn.addEventListener('click', () => toggleSound(spSoundToggleBtn));

ballSpeedSlider.addEventListener('input', () => {
    ballSpeedValue.textContent = ballSpeedSlider.value;
    settings.ballSpeed = parseInt(ballSpeedSlider.value);
});

spBallSpeedSlider.addEventListener('input', () => {
    spBallSpeedValue.textContent = spBallSpeedSlider.value;
    settings.ballSpeed = parseInt(spBallSpeedSlider.value);
});

powerupsToggle.addEventListener('change', () => {
    settings.powerupsEnabled = powerupsToggle.checked;
});

spPowerupsToggle.addEventListener('change', () => {
    settings.powerupsEnabled = spPowerupsToggle.checked;
});

// Game over UI event listeners
rematchBtn.addEventListener('click', requestRematch);
menuBtn.addEventListener('click', () => {
    gameOverUI.style.display = 'none';
    resetToSinglePlayer();
});

function toggleSound(button) {
    settings.soundEnabled = !settings.soundEnabled;
    Object.values(sounds).forEach(sound => {
        sound.muted = !settings.soundEnabled;
    });
    
    if (settings.soundEnabled) {
        button.innerHTML = '<i class="fas fa-volume-up"></i> Disable Sound';
    } else {
        button.innerHTML = '<i class="fas fa-volume-mute"></i> Enable Sound';
    }
    
    // Update the other sound button to match
    if (button === soundToggleBtn && spSoundToggleBtn) {
        if (settings.soundEnabled) {
            spSoundToggleBtn.innerHTML = '<i class="fas fa-volume-up"></i> Disable Sound';
        } else {
            spSoundToggleBtn.innerHTML = '<i class="fas fa-volume-mute"></i> Enable Sound';
        }
    } else if (button === spSoundToggleBtn && soundToggleBtn) {
        if (settings.soundEnabled) {
            soundToggleBtn.innerHTML = '<i class="fas fa-volume-up"></i> Disable Sound';
        } else {
            soundToggleBtn.innerHTML = '<i class="fas fa-volume-mute"></i> Enable Sound';
        }
    }
}

function showSettings() {
    settingsUI.style.display = 'flex';
}

function hideSettings() {
    settingsUI.style.display = 'none';
}

function requestRematch() {
    if (isMultiplayer) {
        // Reset game but keep multiplayer state
        resetGame();
        if (isHost) {
            socket.emit('rematchRequest', roomId);
        }
    } else {
        resetGame();
        gameOverUI.style.display = 'none';
    }
}

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
                : 'https://ping-pong-multiplayer.onrender.com'; // Replace with your actual deployed URL
        
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
            updatePlayerInfo();
            updateRoomStatus(`Room created! Share code: ${roomId}`, 'success');
        });
        
        socket.on('roomJoined', (id) => {
            roomId = id;
            isHost = false;
            playerRole = 'right';
            updatePlayerInfo();
            updateRoomStatus(`Joined room: ${roomId}`, 'success');
        });
        
        socket.on('roomError', (message) => {
            updateRoomStatus(message, 'error');
        });
        
        socket.on('playerJoined', (players) => {
            if (players.length === 2) {
                updateRoomStatus('Game ready! Both players connected.', 'success');
                updatePlayerInfo(players.length);
            }
        });
        
        socket.on('gameReady', (roles) => {
            isMultiplayer = true;
            playerRole = roles[socket.id];
            console.log('Game ready, I am:', playerRole, 'isHost:', isHost);
            
            // Reset scores to be sure
            playerScore = 0;
            opponentScore = 0;
            
            // Set player position based on role
            if (playerRole === 'right') {
                player.x = width - paddleWidth - 10;
                player.color = colors.secondary;
                opponent.x = 10;
                opponent.color = colors.primary;
            } else {
                player.x = 10;
                player.color = colors.primary;
                opponent.x = width - paddleWidth - 10;
                opponent.color = colors.secondary;
            }
            
            // Update score labels based on roles
            updateScoreLabels();
            
            updatePlayerInfo(2);
            
            // Start the game for both host and joining player
            startMultiplayerGame();
            
            // If not host, we don't control the ball
            if (!isHost) {
                updateRoomStatus('Game started!', 'success');
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
            console.log('Received score sync:', data);
            playerScore = data.playerScore;
            opponentScore = data.opponentScore;
            updateScoreDisplay();
        });
        
        socket.on('playerLeft', () => {
            if (isMultiplayer) {
                updateRoomStatus('Opponent disconnected', 'error');
                resetToSinglePlayer();
            }
        });
        
        // Add new event handlers for powerups and rematch
        socket.on('powerupSpawned', (powerupData) => {
            if (!isHost) {
                spawnPowerup(powerupData.x, powerupData.y, powerupData.type, powerupData.id);
            }
        });
        
        socket.on('powerupCollected', (data) => {
            collectPowerup(data.id, data.playerRole);
        });
        
        socket.on('rematchAccepted', () => {
            resetGame();
            startMultiplayerGame();
        });
        
        socket.on('rematchRequest', () => {
            // Show rematch request dialog
            if (confirm('Opponent wants a rematch. Accept?')) {
                socket.emit('rematchAccepted', roomId);
                resetGame();
                startMultiplayerGame();
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

function updatePlayerInfo(playerCount) {
    if (!playerInfo) return;
    
    let roleText = '';
    let statusClass = '';
    
    if (playerRole === 'left') {
        roleText = 'You are: LEFT PADDLE (Controls game)';
        statusClass = 'host';
    } else if (playerRole === 'right') {
        roleText = 'You are: RIGHT PADDLE (Waiting for host)';
        statusClass = 'client';
    } else {
        roleText = 'Waiting for role assignment...';
        statusClass = 'waiting';
    }
    
    let connectedText = '';
    if (playerCount === 1) {
        connectedText = '<div class="waiting">Waiting for opponent to join...</div>';
    } else if (playerCount === 2) {
        connectedText = '<div class="success">Both players connected!</div>';
    }
    
    playerInfo.innerHTML = `
        <div class="player-role ${statusClass}">${roleText}</div>
        ${connectedText}
    `;
    
    playerInfo.style.display = 'block';
}

function updateRoomStatus(message, type) {
    roomStatus.textContent = message;
    roomStatus.className = type;
    
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
    // Set up game state
    gameStarted = false;
    gameOver = false;
    playerScore = 0;
    opponentScore = 0;
    updateScoreDisplay();
    
    // Reset game elements
    player.y = height / 2 - player.height / 2;
    opponent.y = height / 2 - opponent.height / 2;
    resetBall();
    
    // Clear visual effects
    particles.length = 0;
    trails.length = 0;
    
    // Clear powerups
    powerups = [];
    
    // Hide multiplayer UI
    multiplayerUI.style.display = 'none';
    gameOverUI.style.display = 'none';
    
    // Start countdown
    startCountdown();
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
    updateScoreDisplay();
    resetBall();
    
    // Reset score labels
    updateScoreLabels();
    
    // Reset powerups
    powerups = [];
    resetPaddlePowerups();
    
    // Reset UI
    multiplayerUI.style.display = 'none';
    gameOverUI.style.display = 'none';
    if (playerInfo) playerInfo.style.display = 'none';
}

// Start a countdown before game begins
function startCountdown() {
    countdown = 3;
    
    // Play start sound
    if (settings.soundEnabled) {
        sounds.gameStart.currentTime = 0;
        sounds.gameStart.play();
    }
    
    const countdownInterval = setInterval(() => {
        countdown--;
        
        if (countdown <= 0) {
            clearInterval(countdownInterval);
            gameStarted = true;
            lastTime = performance.now();
            gameLoop(lastTime);
            countdown = null;
        }
    }, 1000);
}

// Game functions
function startGame() {
    if (!gameStarted) {
        startCountdown();
    }
}

function restartGame() {
    resetGame();
    startCountdown();
}

function resetGame() {
    // Reset game state
    gameStarted = false;
    gameOver = false;
    playerScore = 0;
    opponentScore = 0;
    updateScoreDisplay();
    
    // Reset elements positions
    player.y = height / 2 - player.height / 2;
    opponent.y = height / 2 - opponent.height / 2;
    resetBall();
    
    // Reset powerups
    powerups = [];
    resetPaddlePowerups();
    
    // Clear effects
    particles.length = 0;
    trails.length = 0;
    
    // Hide game over UI
    gameOverUI.style.display = 'none';
    
    // Redraw everything
    draw();
}

function resetPaddlePowerups() {
    // Reset paddle sizes and speeds
    player.height = player.originalHeight;
    player.speed = player.originalSpeed;
    opponent.height = opponent.originalHeight;
    opponent.speed = opponent.originalSpeed;
    player.powerups = [];
    opponent.powerups = [];
}

function resetBall() {
    ball.x = width / 2;
    ball.y = height / 2;
    ball.speed = settings.ballSpeed;
    
    // Randomize initial direction
    ball.velocityX = Math.random() > 0.5 ? -ball.speed : ball.speed;
    ball.velocityY = Math.random() * 10 - 5; // Random Y direction
    
    // Clear trailing effect
    trails.length = 0;
    
    // Reset last score time to prevent immediate scoring
    lastScoreTime = performance.now();
}

function updateScore() {
    console.log('Updating score:', playerScore, opponentScore);
    
    // Play score sound
    if (settings.soundEnabled) {
        sounds.score.currentTime = 0;
        sounds.score.play();
    }
    
    // Update the display
    updateScoreDisplay();
    
    // In multiplayer, update opponent's score too
    if (isMultiplayer && isHost) {
        console.log('Sending score update to opponent');
        socket.emit('scoreUpdate', {
            roomId,
            playerScore,
            opponentScore
        });
    }
}

function updateScoreDisplay() {
    playerScoreElem.textContent = playerScore;
    computerScoreElem.textContent = opponentScore;
}

function collision(obj1, obj2) {
    return (
        obj1.x < obj2.x + obj2.width &&
        obj1.x + obj1.size > obj2.x &&
        obj1.y < obj2.y + obj2.height &&
        obj1.y + obj1.size > obj2.y
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
        
        // Play wall sound
        if (settings.soundEnabled) {
            sounds.wall.currentTime = 0;
            sounds.wall.play();
        }
        
        // Add particles effect
        createParticles(ball.x, ball.y <= 0 ? 0 : height, 10, '#ffffff');
    }
    
    // For multiplayer - ensure correct paddle check based on ball direction and player role
    let paddleToCheck;
    
    if (ball.velocityX < 0) {
        // Ball is going left - check the left paddle
        paddleToCheck = player.x === 10 ? player : opponent;
    } else {
        // Ball is going right - check the right paddle
        paddleToCheck = player.x === 10 ? opponent : player;
    }
    
    // Paddle collision
    if (collision(ball, paddleToCheck)) {
        // Reverse ball direction
        ball.velocityX = -ball.velocityX * 1.05; // Increase speed slightly
        
        // Play paddle sound
        if (settings.soundEnabled) {
            sounds.paddle.currentTime = 0;
            sounds.paddle.play();
        }
        
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
    
    // Check for powerup collisions
    for (let i = powerups.length - 1; i >= 0; i--) {
        const powerup = powerups[i];
        
        // Check if ball collided with powerup
        if (distance(ball.x + ball.size/2, ball.y + ball.size/2, 
                    powerup.x, powerup.y) < (ball.size/2 + powerup.radius)) {
            
            // Determine which player gets the powerup
            const powerupTarget = ball.velocityX < 0 ? 'right' : 'left';
            collectPowerup(powerup.id, powerupTarget);
            
            // Sync powerup collection in multiplayer
            if (isMultiplayer) {
                socket.emit('powerupCollected', {
                    roomId,
                    id: powerup.id,
                    playerRole: powerupTarget
                });
            }
        }
    }
    
    // Check for scoring only after the delay has passed
    const currentTime = performance.now();
    if (currentTime - lastScoreTime < scoreDelay) {
        // If we're in the delay period but the ball would score, move it back to prevent scoring
        if (ball.x < 0 || ball.x > width) {
            ball.x = ball.x < 0 ? 0 : width - ball.size;
            ball.velocityX = -ball.velocityX;
        }
        return;
    }
    
    // Ball goes out of bounds - Score!
    if (ball.x < 0) {
        // Right scores
        lastScoreTime = currentTime;
        
        if (isHost) {
            if (playerRole === 'right') {
                playerScore++;
            } else {
                opponentScore++;
            }
        }
        
        updateScore();
        
        // Scoring effects
        createParticles(0, ball.y, 30, opponent.color);
        scoreFlash = { active: true, alpha: 1, side: 'right' };
        
        checkGameOver();
        resetBall();
        resetPaddlePowerups();
    } else if (ball.x > width) {
        // Left scores
        lastScoreTime = currentTime;
        
        if (isHost) {
            if (playerRole === 'left') {
                playerScore++;
            } else {
                opponentScore++;
            }
        }
        
        updateScore();
        
        // Scoring effects
        createParticles(width, ball.y, 30, player.color);
        scoreFlash = { active: true, alpha: 1, side: 'left' };
        
        checkGameOver();
        resetBall();
        resetPaddlePowerups();
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

// Powerup system
function spawnPowerup(x, y, type, id) {
    // If powerups are disabled in settings, don't spawn
    if (!settings.powerupsEnabled) return;
    
    const powerup = {
        id: id || Math.random().toString(36).substring(2, 10),
        x: x || Math.random() * (width - 100) + 50,
        y: y || Math.random() * (height - 100) + 50,
        type: type || getRandomPowerupType(),
        radius: 15,
        alpha: 1,
        rotation: 0
    };
    
    powerups.push(powerup);
    
    // In multiplayer, sync powerup spawn
    if (isMultiplayer && isHost && !x) {
        socket.emit('powerupSpawned', {
            roomId,
            id: powerup.id,
            x: powerup.x,
            y: powerup.y,
            type: powerup.type
        });
    }
    
    return powerup;
}

function getRandomPowerupType() {
    const types = Object.values(POWERUP_TYPES);
    return types[Math.floor(Math.random() * types.length)];
}

function collectPowerup(id, playerRole) {
    const index = powerups.findIndex(p => p.id === id);
    if (index === -1) return;
    
    const powerup = powerups[index];
    powerups.splice(index, 1);
    
    // Play powerup sound
    if (settings.soundEnabled) {
        sounds.powerup.currentTime = 0;
        sounds.powerup.play();
    }
    
    // Create collection effect
    createParticles(powerup.x, powerup.y, 20, getPowerupColor(powerup.type));
    
    // Apply powerup effect
    applyPowerup(powerup.type, playerRole);
}

function getPowerupColor(type) {
    switch(type) {
        case POWERUP_TYPES.SPEED_UP:
            return colors.powerupSpeed;
        case POWERUP_TYPES.ENLARGE_PADDLE:
            return colors.powerupSize;
        case POWERUP_TYPES.SLOW_OPPONENT:
            return colors.powerupSlow;
        default:
            return '#ffffff';
    }
}

function applyPowerup(type, playerRole) {
    // Determine which paddle gets the powerup
    const targetPaddle = (playerRole === 'left') ? 
        (player.x === 10 ? player : opponent) :
        (player.x === 10 ? opponent : player);
    
    const otherPaddle = targetPaddle === player ? opponent : player;
    
    // Apply effect based on type
    switch(type) {
        case POWERUP_TYPES.SPEED_UP:
            targetPaddle.speed *= 1.5;
            targetPaddle.powerups.push({
                type,
                duration: 10000,
                startTime: performance.now()
            });
            break;
        case POWERUP_TYPES.ENLARGE_PADDLE:
            targetPaddle.height = Math.min(targetPaddle.height * 1.5, height * 0.5);
            targetPaddle.powerups.push({
                type,
                duration: 8000,
                startTime: performance.now()
            });
            break;
        case POWERUP_TYPES.SLOW_OPPONENT:
            otherPaddle.speed *= 0.5;
            otherPaddle.powerups.push({
                type,
                duration: 5000,
                startTime: performance.now()
            });
            break;
    }
}

function updatePowerups(currentTime) {
    // Update active powerups
    [player, opponent].forEach(paddle => {
        for (let i = paddle.powerups.length - 1; i >= 0; i--) {
            const powerup = paddle.powerups[i];
            if (currentTime - powerup.startTime > powerup.duration) {
                // Powerup expired, remove effect
                switch(powerup.type) {
                    case POWERUP_TYPES.SPEED_UP:
                        paddle.speed = paddle.originalSpeed;
                        break;
                    case POWERUP_TYPES.ENLARGE_PADDLE:
                        paddle.height = paddle.originalHeight;
                        break;
                    case POWERUP_TYPES.SLOW_OPPONENT:
                        paddle.speed = paddle.originalSpeed;
                        break;
                }
                paddle.powerups.splice(i, 1);
            }
        }
    });
    
    // Randomly spawn new powerups (only in host mode for multiplayer)
    if (!isMultiplayer || isHost) {
        if (powerups.length < 3 && Math.random() < 0.005 && settings.powerupsEnabled) {
            spawnPowerup();
        }
    }
    
    // Update powerup animations
    for (let i = powerups.length - 1; i >= 0; i--) {
        const powerup = powerups[i];
        powerup.rotation += 0.02;
        
        // Remove powerups that have been on screen for too long
        if (powerup.alpha <= 0) {
            powerups.splice(i, 1);
        }
    }
}

function checkGameOver() {
    if (playerScore >= winningScore || opponentScore >= winningScore) {
        gameOver = true;
        gameStarted = false;
        
        // Victory particles burst
        const color = playerScore >= winningScore ? player.color : opponent.color;
        createParticles(width/2, height/2, 100, color);
        
        // Show game over UI
        const gameResult = document.getElementById('game-result');
        if (playerScore >= winningScore) {
            gameResult.textContent = 'You Win!';
        } else {
            gameResult.textContent = 'Opponent Wins!';
        }
        gameOverUI.style.display = 'flex';
    }
}

// Utility functions
function distance(x1, y1, x2, y2) {
    return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
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
    
    // Draw powerups
    for (let i = 0; i < powerups.length; i++) {
        const powerup = powerups[i];
        drawPowerup(powerup);
    }
    
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
    
    // Draw multiplayer role info if in multiplayer mode
    if (isMultiplayer && gameStarted) {
        const leftLabel = playerRole === 'left' ? "YOU" : "OPPONENT";
        const rightLabel = playerRole === 'right' ? "YOU" : "OPPONENT";
        
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.font = '12px Poppins, sans-serif';
        ctx.textAlign = 'center';
        
        // Draw on paddles
        ctx.fillText(leftLabel, 20, height - 10);
        ctx.fillText(rightLabel, width - 20, height - 10);
    }
    
    // Draw game status
    if (!gameStarted && !gameOver) {
        if (countdown !== null) {
            // Draw countdown
            ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
            ctx.font = '64px Poppins, sans-serif';
            ctx.textAlign = 'center';
            ctx.shadowColor = colors.primary;
            ctx.shadowBlur = 15;
            ctx.fillText(countdown, width / 2, height / 2);
            ctx.shadowBlur = 0;
        } else {
            drawGameMessage("Press 'Start Game' to play", width / 2, height / 2, '20px');
        }
    } else if (gameOver && gameOverUI.style.display !== 'flex') {
        const message = playerScore >= winningScore ? "You Win!" : "Opponent Wins!";
        drawGameMessage(message, width / 2, height / 2, '30px');
        drawGameMessage("Press 'Restart' to play again", width / 2, height / 2 + 40, '20px');
    }
}

function drawPowerup(powerup) {
    const color = getPowerupColor(powerup.type);
    
    // Draw glow
    const gradient = ctx.createRadialGradient(
        powerup.x, powerup.y, 0,
        powerup.x, powerup.y, powerup.radius * 2
    );
    gradient.addColorStop(0, color);
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
    
    ctx.beginPath();
    ctx.fillStyle = gradient;
    ctx.globalAlpha = 0.3;
    ctx.arc(powerup.x, powerup.y, powerup.radius * 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    
    // Draw powerup icon
    ctx.save();
    ctx.translate(powerup.x, powerup.y);
    ctx.rotate(powerup.rotation);
    
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 10;
    
    // Draw different shapes based on powerup type
    switch(powerup.type) {
        case POWERUP_TYPES.SPEED_UP:
            // Draw lightning bolt
            ctx.beginPath();
            ctx.moveTo(-5, -8);
            ctx.lineTo(2, -2);
            ctx.lineTo(-2, 2);
            ctx.lineTo(5, 8);
            ctx.lineTo(0, 0);
            ctx.lineTo(5, -4);
            ctx.closePath();
            ctx.fill();
            break;
        case POWERUP_TYPES.ENLARGE_PADDLE:
            // Draw rectangle (paddle)
            ctx.fillRect(-7, -3, 14, 6);
            break;
        case POWERUP_TYPES.SLOW_OPPONENT:
            // Draw snowflake
            for (let i = 0; i < 6; i++) {
                ctx.rotate(Math.PI / 3);
                ctx.beginPath();
                ctx.moveTo(0, 0);
                ctx.lineTo(0, -8);
                ctx.stroke();
                
                ctx.beginPath();
                ctx.moveTo(-3, -6);
                ctx.lineTo(0, -8);
                ctx.lineTo(3, -6);
                ctx.stroke();
            }
            break;
    }
    
    ctx.shadowBlur = 0;
    ctx.restore();
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
    
    // Draw powerup indicators on paddle
    paddle.powerups.forEach((powerup, index) => {
        const indicatorSize = 5;
        const x = paddle.x + (paddle.width / 2) - indicatorSize / 2;
        const y = paddle.y + 5 + (index * 8);
        
        ctx.fillStyle = getPowerupColor(powerup.type);
        ctx.fillRect(x, y, indicatorSize, indicatorSize);
    });
    
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
        updatePowerups(currentTime);
    }
    
    updateParticles(deltaTime);
    draw();
    
    // Continue the game loop
    requestAnimationFrame(gameLoop);
}

// Initial draw
draw();

// Add this function to update the score labels based on multiplayer role
function updateScoreLabels() {
    if (!isMultiplayer) {
        leftPlayerLabel.textContent = 'You';
        rightPlayerLabel.textContent = 'Opponent';
        return;
    }
    
    if (playerRole === 'left') {
        leftPlayerLabel.textContent = 'You';
        rightPlayerLabel.textContent = 'Opponent';
    } else {
        leftPlayerLabel.textContent = 'Opponent';
        rightPlayerLabel.textContent = 'You';
    }
} 