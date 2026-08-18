import { Server, Socket } from 'socket.io';
import { RedisClientType } from 'redis';
import { Message } from '../models/Message';

const CHANNEL_PREFIX = 'chat:room:';

export function registerChatHandlers(
  io: Server,
  socket: Socket,
  pub: RedisClientType,
  sub: RedisClientType
) {
  const user = (socket as any).user;

  // ─── Send Message ────────────────────────────────────────────────────────
  socket.on('send_message', async (data: { room: string; content: string }) => {
    if (!data.room || !data.content?.trim()) return;
    if (data.content.length > 2000) {
      return socket.emit('error', { message: 'Message too long (max 2000 chars)' });
    }

    const message = {
      id: `msg_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      room: data.room,
      sender: user.username,
      content: data.content.trim(),
      timestamp: new Date().toISOString(),
    };

    // Persist to MongoDB
    try {
      await Message.create(message);
    } catch (err) {
      console.error('[Chat] Failed to persist message:', err);
    }

    // Publish to Redis channel (reaches ALL server instances)
    await pub.publish(`${CHANNEL_PREFIX}${data.room}`, JSON.stringify(message));
  });

  // ─── Typing Indicators ────────────────────────────────────────────────────
  socket.on('typing_start', (data: { room: string }) => {
    socket.to(data.room).emit('typing', { username: user.username, room: data.room });
  });

  socket.on('typing_stop', (data: { room: string }) => {
    socket.to(data.room).emit('stopped_typing', { username: user.username, room: data.room });
  });

  // ─── Subscribe to Redis channel when joining a room ───────────────────────
  // Called from registerRoomHandlers after join
  ;(socket as any).subscribeToRoom = async (room: string) => {
    const channel = `${CHANNEL_PREFIX}${room}`;
    await sub.subscribe(channel, (rawMessage: string) => {
      try {
        const msg = JSON.parse(rawMessage);
        // Broadcast to all sockets in the Socket.io room
        io.to(room).emit('message', msg);
      } catch {}
    });
  };

  ;(socket as any).unsubscribeFromRoom = async (room: string) => {
    await sub.unsubscribe(`${CHANNEL_PREFIX}${room}`);
  };
}
