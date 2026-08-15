const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

const WORDS = [
  'apple', 'banana', 'guitar', 'laptop', 'rocket', 'castle', 'bridge',
  'dragon', 'pizza', 'telescope', 'penguin', 'volcano', 'bicycle', 'robot'
];

const rooms = {};

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  socket.on('join-room', ({ roomCode, username }) => {
    socket.join(roomCode);
    socket.username = username;
    socket.roomCode = roomCode;

    if (!rooms[roomCode]) {
      rooms[roomCode] = {
        users: [],
        drawer: null,
        word: '',
        scores: {},
        gameActive: false,
        timer: 60,
        interval: null
      };
    }

    const room = rooms[roomCode];
    room.users.push({ id: socket.id, username });
    room.scores[socket.id] = room.scores[socket.id] || 0;

    io.to(roomCode).emit('update-users', room.users);
    io.to(roomCode).emit('update-scores', room.scores);

    if (room.users.length >= 2 && !room.gameActive) {
      startNewRound(roomCode);
    }
  });

  socket.on('draw', (data) => {
    socket.to(data.roomCode).emit('draw', data);
  });

  socket.on('clear-canvas', (roomCode) => {
    io.to(roomCode).emit('clear-canvas');
  });

  socket.on('chat-message', ({ roomCode, message }) => {
    const room = rooms[roomCode];
    if (!room) return;

    if (room.gameActive && message.toLowerCase().trim() === room.word.toLowerCase()) {
      io.to(roomCode).emit('chat-message', {
        username: 'System',
        message: `${socket.username} guessed the word correctly! (${room.word})`,
        isSystem: true
      });
      room.scores[socket.id] = (room.scores[socket.id] || 0) + 10;
      io.to(roomCode).emit('update-scores', room.scores);
      clearInterval(room.interval);
      startNewRound(roomCode);
    } else {
      io.to(roomCode).emit('chat-message', {
        username: socket.username,
        message,
        isSystem: false
      });
    }
  });

  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
    const roomCode = socket.roomCode;
    if (roomCode && rooms[roomCode]) {
      const room = rooms[roomCode];
      room.users = room.users.filter(u => u.id !== socket.id);
      io.to(roomCode).emit('update-users', room.users);

      if (room.users.length === 0) {
        clearInterval(room.interval);
        delete rooms[roomCode];
      } else if (socket.id === room.drawer) {
        clearInterval(room.interval);
        startNewRound(roomCode);
      }
    }
  });
});

function startNewRound(roomCode) {
  const room = rooms[roomCode];
  if (!room || room.users.length === 0) return;

  room.gameActive = true;
  room.word = WORDS[Math.floor(Math.random() * WORDS.length)];

  const currentIndex = room.users.findIndex(u => u.id === room.drawer);
  const nextIndex = (currentIndex + 1) % room.users.length;
  room.drawer = room.users[nextIndex].id;

  io.to(roomCode).emit('clear-canvas');
  io.to(roomCode).emit('new-round', {
    drawerId: room.drawer,
    drawerName: room.users[nextIndex].username,
    word: room.word
  });

  room.timer = 60;
  clearInterval(room.interval);
  room.interval = setInterval(() => {
    room.timer--;
    io.to(roomCode).emit('timer', room.timer);
    if (room.timer <= 0) {
      clearInterval(room.interval);
      io.to(roomCode).emit('chat-message', {
        username: 'System',
        message: `Time is up! The word was: ${room.word}`,
        isSystem: true
      });
      startNewRound(roomCode);
    }
  }, 1000);
}

const PORT = process.env.PORT || 3000;
// Bind to '0.0.0.0' for live network accessibility
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Scribble server running on port ${PORT}`);
});