const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const path = require('path');

// Setup server
const app = express();
const server = http.createServer(app);
const io = socketIO(server);

// Serve static files
app.use(express.static('./'));

// Game rooms
const rooms = {};

// Socket.IO connection handling
io.on('connection', (socket) => {
    console.log('New player connected:', socket.id);
    
    // Create a new game room
    socket.on('createRoom', (roomId) => {
        console.log(`Creating room: ${roomId}`);
        
        // Check if room already exists
        if (rooms[roomId]) {
            socket.emit('roomError', 'Room already exists');
            return;
        }
        
        // Join the room
        socket.join(roomId);
        
        // Create room data
        rooms[roomId] = {
            id: roomId,
            players: [socket.id],
            gameStarted: false
        };
        
        // Notify the client that room was created
        socket.emit('roomCreated', roomId);
    });
    
    // Join an existing game room
    socket.on('joinRoom', (roomId) => {
        console.log(`Player ${socket.id} joining room: ${roomId}`);
        
        // Check if room exists
        if (!rooms[roomId]) {
            socket.emit('roomError', 'Room does not exist');
            return;
        }
        
        // Check if room is full
        if (rooms[roomId].players.length >= 2) {
            socket.emit('roomError', 'Room is full');
            return;
        }
        
        // Join the room
        socket.join(roomId);
        rooms[roomId].players.push(socket.id);
        
        // Notify all clients in the room
        socket.emit('roomJoined', roomId);
        io.to(roomId).emit('playerJoined', rooms[roomId].players);
        
        // If we now have 2 players, the game can start
        if (rooms[roomId].players.length === 2) {
            rooms[roomId].gameStarted = true;
            
            // Assign roles (who is left/right paddle)
            const roles = {
                [rooms[roomId].players[0]]: 'left',
                [rooms[roomId].players[1]]: 'right'
            };
            
            // Inform players that game is ready to start
            io.to(roomId).emit('gameReady', roles);
        }
    });
    
    // Handle player movement
    socket.on('paddleMove', (data) => {
        const { roomId, position } = data;
        
        // Check if room exists
        if (!rooms[roomId]) return;
        
        // Relay paddle position to the other player
        socket.to(roomId).emit('opponentMove', position);
    });
    
    // Handle ball update (only host updates ball)
    socket.on('ballUpdate', (data) => {
        const { roomId, ballData } = data;
        
        // Check if room exists
        if (!rooms[roomId]) return;
        
        // Relay ball position to the other player
        socket.to(roomId).emit('ballSync', ballData);
    });
    
    // Handle score update
    socket.on('scoreUpdate', (data) => {
        const { roomId, playerScore, opponentScore } = data;
        
        // Check if room exists
        if (!rooms[roomId]) return;
        
        // Relay score to other player
        socket.to(roomId).emit('scoreSync', { 
            playerScore: opponentScore, 
            opponentScore: playerScore 
        });
    });
    
    // Handle player disconnect
    socket.on('disconnect', () => {
        console.log('Player disconnected:', socket.id);
        
        // Find rooms the player was in
        for (const roomId in rooms) {
            const room = rooms[roomId];
            
            // If player was in this room
            const index = room.players.indexOf(socket.id);
            if (index !== -1) {
                // Remove player from room
                room.players.splice(index, 1);
                
                // If room is now empty, delete it
                if (room.players.length === 0) {
                    delete rooms[roomId];
                    console.log(`Room ${roomId} deleted`);
                } else {
                    // Notify other player about disconnect
                    io.to(roomId).emit('playerLeft');
                    rooms[roomId].gameStarted = false;
                }
            }
        }
    });
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
}); 