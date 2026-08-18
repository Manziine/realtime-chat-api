# Real-Time Chat API

<div align="center">

![Node.js](https://img.shields.io/badge/Node.js-339933?style=flat-square&logo=nodedotjs&logoColor=white)
![Socket.io](https://img.shields.io/badge/Socket.io-010101?style=flat-square&logo=socketdotio&logoColor=white)
![Redis](https://img.shields.io/badge/Redis-DC382D?style=flat-square&logo=redis&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-47A248?style=flat-square&logo=mongodb&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2496ED?style=flat-square&logo=docker&logoColor=white)

**Production-grade real-time chat backend** — WebSocket rooms, JWT auth, message persistence, Redis Pub/Sub for multi-instance scaling, and full Docker deployment.

</div>

---

## 🎯 Why This Project

Real-time systems are one of the most-tested concepts in backend interviews. This project demonstrates:

- **WebSocket mastery**: Bidirectional, event-driven communication with Socket.io
- **Scalability thinking**: Redis Pub/Sub lets multiple server instances share messages
- **Auth at scale**: JWT-based WebSocket authentication (not just REST)
- **Data modeling**: MongoDB for flexible message schema + Redis for presence/typing indicators

## 🏗️ Architecture

```
         WebSocket Clients
              │   │
         ┌────▼───▼────┐     ┌─────────────────┐
         │  Instance 1  │────▶│  Redis Pub/Sub  │
         └─────────────┘     │  (message relay) │
         ┌─────────────┐     │  (online users)  │
         │  Instance 2  │◀────│  (typing status) │
         └────┬────────┘     └─────────────────┘
              │
         ┌────▼────────────┐
         │     MongoDB     │
         │ (message history│
         │  rooms, users)  │
         └─────────────────┘
```

**Why Redis Pub/Sub?** Without it, users connected to Instance 1 can't receive messages from users on Instance 2. Redis acts as the message bus that makes horizontal scaling work.

## ✅ Features

| Feature | Details |
|---|---|
| 💬 Chat rooms | Create, join, leave named rooms |
| 🔐 JWT auth | Authenticated WebSocket connections |
| 📜 Message history | Last 50 messages on room join |
| ✍️ Typing indicators | Real-time "user is typing..." |
| 🟢 Presence | Online/offline status via Redis |
| 📡 Multi-instance | Redis Pub/Sub for horizontal scaling |
| 🚫 Rate limiting | Prevent message spam |

## 🚀 Quick Start

```bash
git clone https://github.com/Manziine/realtime-chat-api.git
cd realtime-chat-api
cp .env.example .env
docker compose up --build

# Connect via WebSocket at ws://localhost:3000
# See docs at http://localhost:3000/docs
```

### Events Reference

```javascript
// Client → Server
socket.emit('join_room', { room: 'general' });
socket.emit('send_message', { room: 'general', content: 'Hello!' });
socket.emit('typing_start', { room: 'general' });
socket.emit('typing_stop', { room: 'general' });

// Server → Client
socket.on('message', (msg) => console.log(msg));
socket.on('user_joined', (data) => console.log(data.username, 'joined'));
socket.on('typing', (data) => console.log(data.username, 'is typing...'));
socket.on('user_count', (count) => console.log(count, 'online'));
```

## 📁 Project Structure

```
realtime-chat-api/
├── src/
│   ├── handlers/
│   │   ├── chat.js         # WebSocket message handlers
│   │   ├── rooms.js        # Room join/leave logic
│   │   └── presence.js     # Online status via Redis
│   ├── middleware/
│   │   ├── auth.js         # JWT WebSocket auth middleware
│   │   └── rateLimit.js    # Message rate limiting
│   ├── models/
│   │   ├── Message.js      # MongoDB message schema
│   │   └── Room.js         # MongoDB room schema
│   ├── services/
│   │   └── pubsub.js       # Redis Pub/Sub service
│   └── index.js            # Express + Socket.io server
├── .github/workflows/ci.yml
├── docker-compose.yml
├── Dockerfile
├── package.json
├── .env.example
└── README.md
```

## 💡 Technical Deep-Dive

### Message Flow
1. Client emits `send_message` via WebSocket
2. Server validates JWT and rate limit
3. Message saved to MongoDB
4. Message published to Redis channel `room:${roomId}`
5. All server instances subscribed to that channel broadcast to their connected clients

### Presence System
- On connect: `SADD online_users userId`, set `EXPIRE online:userId 30`
- Heartbeat: refresh TTL every 20s
- On disconnect: `SREM online_users userId`

## 🛠️ Built By

**Arnaud Ineza Manzi** — Backend Engineer
📧 ainezamanzi@gmail.com | 🔗 [LinkedIn](https://linkedin.com/in/arnaud-ineza-manzi-471221272)
