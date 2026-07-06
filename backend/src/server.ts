import http from 'http';
import { Server } from 'socket.io';
import app from './app';
import { initRedis } from './config/redis.client';
import { initSocketEvents } from './socket/events';
import dotenv from 'dotenv';

dotenv.config();

const PORT = process.env.PORT || 5000;

const server = http.createServer(app);

// Initialize Socket.IO with CORS settings matching Express CORS config
const io = new Server(server, {
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    methods: ['GET', 'POST'],
  },
});

async function startServer() {
  // Connect to Redis
  await initRedis();

  // Initialize Socket.IO events helper
  initSocketEvents(io);

  io.on('connection', (socket) => {
    console.log(`Socket client connected: ${socket.id}`);
    
    socket.on('disconnect', () => {
      console.log(`Socket client disconnected: ${socket.id}`);
    });
  });

  server.listen(PORT, () => {
    console.log(`MatchDay AI Backend server running on port ${PORT}`);
  });
}

startServer().catch((error) => {
  console.error('Fatal error starting server:', error);
  process.exit(1);
});
export { server, io };
