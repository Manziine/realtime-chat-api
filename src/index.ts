import express from 'express';
import { createServer } from 'http';
import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { createClient } from 'redis';
import { registerChatHandlers } from './handlers/chat';
import { registerRoomHandlers } from './handlers/rooms';
import { registerPresenceHandlers } from './handlers/presence';

const app = express();
const httpServer = createServer(app);

// ─── Socket.io Setup ──────────────────────────────────────────────────────────
const io = new Server(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
  pingInterval: 10000,
  pingTimeout: 5000,
});

// ─── Redis Pub/Sub ────────────────────────────────────────────────────────────
// Two separate clients required: one pub, one sub (redis protocol constraint)
const pub = createClient({ url: process.env.REDIS_URL || 'redis://localhost:6379' });
const sub = pub.duplicate();

async function connectRedis() {
  await pub.connect();
  await sub.connect();
  console.log('[Redis] Pub/Sub clients connected');
}

// ─── JWT Auth Middleware ──────────────────────────────────────────────────────
io.use((socket: Socket, next) => {
  const token = socket.handshake.auth?.token || socket.handshake.query?.token;
  if (!token) {
    return next(new Error('Authentication required. Provide token in handshake.auth.token'));
  }
  try {
    const decoded = jwt.verify(token as string, process.env.JWT_SECRET || 'dev-secret');
    (socket as any).user = decoded;
    next();
  } catch {
    next(new Error('Invalid or expired token'));
  }
});

// ─── Rate Limiting Middleware ─────────────────────────────────────────────────
const MESSAGE_RATE_LIMIT = 5; // messages per second per user
io.use(async (socket: Socket, next) => {
  const userId = (socket as any).user?.sub || socket.id;
  const key = `ratelimit:msg:${userId}`;
  const count = await pub.incr(key);
  if (count === 1) await pub.expire(key, 1);
  if (count > MESSAGE_RATE_LIMIT) {
    return next(new Error('Rate limit exceeded. Slow down.'));
  }
  next();
});

// ─── Connection Handler ───────────────────────────────────────────────────────
io.on('connection', (socket: Socket) => {
  const user = (socket as any).user;
  console.log(`[Socket] Connected: ${socket.id} (user: ${user?.username || 'unknown'})`);

  // Register all event handlers
  registerChatHandlers(io, socket, pub, sub);
  registerRoomHandlers(io, socket, pub);
  registerPresenceHandlers(io, socket, pub);

  socket.on('disconnect', (reason) => {
    console.log(`[Socket] Disconnected: ${socket.id} (reason: ${reason})`);
  });
});

// ─── REST Endpoints ───────────────────────────────────────────────────────────
app.use(express.json());

app.get('/health', (_, res) => {
  res.json({ status: 'ok', connections: io.engine.clientsCount });
});

// Simple token generator for development/testing
app.post('/dev/token', (req, res) => {
  const { username } = req.body;
  if (!username) return res.status(400).json({ error: 'username required' });
  const token = jwt.sign(
    { sub: username, username },
    process.env.JWT_SECRET || 'dev-secret',
    { expiresIn: '24h' }
  );
  res.json({ token, expires_in: '24h' });
});

// ─── Startup ──────────────────────────────────────────────────────────────────
async function start() {
  await connectRedis();

  const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/chatapi';
  await mongoose.connect(mongoUri);
  console.log('[MongoDB] Connected');

  const PORT = process.env.PORT || 3000;
  httpServer.listen(PORT, () => {
    console.log(`[Server] Real-time Chat API running on port ${PORT}`);
    console.log(`[Server] WebSocket endpoint: ws://localhost:${PORT}`);
    console.log(`[Server] REST endpoint:      http://localhost:${PORT}`);
  });
}

start().catch(console.error);
