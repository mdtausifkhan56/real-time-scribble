const socket = io();

const lobby = document.getElementById('lobby');
const gameContainer = document.getElementById('game-container');
const usernameInput = document.getElementById('username-input');
const roomInput = document.getElementById('room-input');
const joinBtn = document.getElementById('join-btn');

const canvas = document.getElementById('paintCanvas');
const ctx = canvas.getContext('2d');
const clearBtn = document.getElementById('clear-btn');
const wordDisplay = document.getElementById('word-display');
const playerList = document.getElementById('player-list');
const displayRoom = document.getElementById('display-room');
const timerDisplay = document.getElementById('timer');

const chatMessages = document.getElementById('chat-messages');
const chatInput = document.getElementById('chat-input');
const sendBtn = document.getElementById('send-btn');
const toolbar = document.getElementById('toolbar');

let username = '';
let roomCode = '';
let isDrawer = false;
let painting = false;
let currentColor = '#000000';
let currentSize = 4;

// Resize canvas scale for responsive displays
canvas.width = 800;
canvas.height = 600;

joinBtn.addEventListener('click', () => {
  username = usernameInput.value.trim();
  roomCode = roomInput.value.trim();

  if (!username || !roomCode) {
    alert('Please enter both a nickname and a room code.');
    return;
  }

  socket.emit('join-room', { roomCode, username });
  lobby.classList.add('hidden');
  gameContainer.classList.remove('hidden');
  displayRoom.textContent = roomCode;
});

// Drawing logic
canvas.addEventListener('mousedown', startPosition);
canvas.addEventListener('mouseup', endPosition);
canvas.addEventListener('mousemove', draw);

canvas.addEventListener('touchstart', (e) => {
  const touch = e.touches[0];
  const mouseEvent = new MouseEvent('mousedown', {
    clientX: touch.clientX,
    clientY: touch.clientY
  });
  canvas.dispatchEvent(mouseEvent);
}, { passive: true });

canvas.addEventListener('touchend', () => {
  const mouseEvent = new MouseEvent('mouseup', {});
  canvas.dispatchEvent(mouseEvent);
}, { passive: true });

canvas.addEventListener('touchmove', (e) => {
  const touch = e.touches[0];
  const mouseEvent = new MouseEvent('mousemove', {
    clientX: touch.clientX,
    clientY: touch.clientY
  });
  canvas.dispatchEvent(mouseEvent);
}, { passive: true });

function startPosition(e) {
  if (!isDrawer) return;
  painting = true;
  draw(e);
}

function endPosition() {
  painting = false;
  ctx.beginPath();
}

function draw(e) {
  if (!painting || !isDrawer) return;

  const rect = canvas.getBoundingClientRect();
  const x = (e.clientX - rect.left) * (canvas.width / rect.width);
  const y = (e.clientY - rect.top) * (canvas.height / rect.height);

  ctx.lineWidth = currentSize;
  ctx.lineCap = 'round';
  ctx.strokeStyle = currentColor;

  ctx.lineTo(x, y);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x, y);

  socket.emit('draw', {
    roomCode,
    x,
    y,
    color: currentColor,
    size: currentSize,
    isDrawing: true
  });
}

socket.on('draw', (data) => {
  ctx.lineWidth = data.size;
  ctx.lineCap = 'round';
  ctx.strokeStyle = data.color;

  ctx.lineTo(data.x, data.y);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(data.x, data.y);
});

clearBtn.addEventListener('click', () => {
  if (!isDrawer) return;
  socket.emit('clear-canvas', roomCode);
});

socket.on('clear-canvas', () => {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
});

// Toolbar configuration
document.querySelectorAll('.color').forEach(el => {
  el.addEventListener('click', (e) => {
    document.querySelectorAll('.color').forEach(c => c.classList.remove('active'));
    e.target.classList.add('active');
    currentColor = e.target.getAttribute('data-color');
  });
});

document.getElementById('custom-color-picker').addEventListener('input', (e) => {
  currentColor = e.target.value;
});

document.querySelectorAll('.brush-size').forEach(el => {
  el.addEventListener('click', (e) => {
    document.querySelectorAll('.brush-size').forEach(b => b.classList.remove('active'));
    e.target.classList.add('active');
    currentSize = parseInt(e.target.getAttribute('data-size'));
  });
});

// Game Events & Updates
socket.on('update-users', (users) => {
  playerList.innerHTML = '';
  users.forEach(user => {
    const li = document.createElement('li');
    li.textContent = user.username;
    playerList.appendChild(li);
  });
});

socket.on('update-scores', (scores) => {
  // Score updates handled dynamically
});

socket.on('new-round', ({ drawerId, drawerName, word }) => {
  isDrawer = socket.id === drawerId;
  if (isDrawer) {
    wordDisplay.textContent = `Your turn to draw: ${word.toUpperCase()}`;
    toolbar.style.display = 'flex';
  } else {
    wordDisplay.textContent = `${drawerName} is drawing... Guess the word!`;
    toolbar.style.display = 'none';
  }
});

socket.on('timer', (time) => {
  timerDisplay.textContent = time;
});

// Chat logic
sendBtn.addEventListener('click', sendChatMessage);
chatInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') sendChatMessage();
});

function sendChatMessage() {
  const message = chatInput.value.trim();
  if (!message) return;
  socket.emit('chat-message', { roomCode, message });
  chatInput.value = '';
}

socket.on('chat-message', ({ username: sender, message, isSystem }) => {
  const div = document.createElement('div');
  div.classList.add('chat-message');
  if (isSystem) div.classList.add('system');
  div.textContent = `${sender}: ${message}`;
  chatMessages.appendChild(div);
  chatMessages.scrollTop = chatMessages.scrollHeight;
});