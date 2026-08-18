import { Server, Socket } from 'socket.io';
import { RedisClientType } from 'redis';
import { Message } from '../models/Message';

export function registerRoomHandlers(
  io: Server,
  socket: Socket,
  pub: RedisClientType
) {
  const user = (socket as any).user;

  // ─── Join Room ────────────────────────────────────────────────────────────
  socket.on('join_room', async (data: { room: string }) => {
    if (!data.room || typeof data.room !== 'string') return;
    const room = data.room.trim().toLowerCase().replace(/[^a-z0-9-_]/g, '');
    if (!room) return;

    socket.join(room);

    // Track user in room (Redis set)
    await pub.sAdd(`room:${room}:users`, user.username);

    // Fetch last 50 messages from MongoDB
    const history = await Message.find({ room })
      .sort({ timestamp: -1 })
      .limit(50)
      .lean();

    // Send message history to the joining user only
    socket.emit('history', {
      room,
      messages: history.reverse(),
    });

    // Notify others in the room
    socket.to(room).emit('user_joined', {
      username: user.username,
      room,
      timestamp: new Date().toISOString(),
    });

    // Send updated user count to everyone in room
    const memberCount = await pub.sCard(`room:${room}:users`);
    io.to(room).emit('user_count', { room, count: memberCount });

    // Subscribe this server instance to the Redis channel
    await (socket as any).subscribeToRoom?.(room);

    console.log(`[Room] ${user.username} joined #${room}`);
  });

  // ─── Leave Room ───────────────────────────────────────────────────────────
  socket.on('leave_room', async (data: { room: string }) => {
    const room = data.room;
    socket.leave(room);

    await pub.sRem(`room:${room}:users`, user.username);
    await (socket as any).unsubscribeFromRoom?.(room);

    socket.to(room).emit('user_left', {
      username: user.username,
      room,
      timestamp: new Date().toISOString(),
    });

    const memberCount = await pub.sCard(`room:${room}:users`);
    io.to(room).emit('user_count', { room, count: memberCount });
    console.log(`[Room] ${user.username} left #${room}`);
  });

  // ─── Get Room Members ─────────────────────────────────────────────────────
  socket.on('get_members', async (data: { room: string }) => {
    const members = await pub.sMembers(`room:${data.room}:users`);
    socket.emit('room_members', { room: data.room, members });
  });

  // ─── Auto-leave on disconnect ─────────────────────────────────────────────
  socket.on('disconnect', async () => {
    const rooms = Array.from(socket.rooms).filter(r => r !== socket.id);
    for (const room of rooms) {
      await pub.sRem(`room:${room}:users`, user.username);
      io.to(room).emit('user_left', {
        username: user.username,
        room,
        timestamp: new Date().toISOString(),
      });
    }
  });
}
