const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
require('dotenv').config();

const { initializeDatabase } = require('./db');
const roomManager = require('./models/RoomManager');
const registerSocketHandlers = require('./handlers/socketHandler');

const app = express();
const server = http.createServer(app);

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST']
}));

app.use(express.json());

const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

registerSocketHandlers(io);

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy', timestamp: new Date().toISOString() });
});

app.get('/api/rooms/:roomId', async (req, res) => {
  const { roomId } = req.params;
  let room = roomManager.getRoom(roomId);
  if (!room) {
    room = await roomManager.loadRoomFromDb(roomId);
  }

  if (!room) {
    return res.status(404).json({ error: 'Room not found' });
  }

  res.status(200).json(room.toJSON());
});

app.post('/api/rooms', async (req, res) => {
  const { roomId, hostId, videoId } = req.body;
  if (!roomId || !hostId) {
    return res.status(400).json({ error: 'roomId and hostId are required' });
  }

  let room = roomManager.getRoom(roomId);
  if (!room) {
    room = await roomManager.loadRoomFromDb(roomId);
  }

  if (!room) {
    room = roomManager.createRoom(roomId, hostId, videoId || '');
  }

  res.status(200).json(room.toJSON());
});

const PORT = process.env.PORT || 5001;

let dbInitialized = false;
const ensureDb = async () => {
  if (!dbInitialized) {
    try {
      await initializeDatabase();
      dbInitialized = true;
    } catch (err) {
      console.error('Database connection failed, starting server in-memory only:', err.message);
    }
  }
};

if (!process.env.VERCEL) {
  ensureDb().finally(() => {
    server.listen(PORT, () => {
      console.log(`Server listening on port ${PORT}`);
    });
  });
}

module.exports = app;
module.exports.default = app;
module.exports.app = app;
module.exports.server = server;
module.exports.io = io;