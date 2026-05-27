# Node.js/Express Backend Implementation Outline

## 1. Setup
- Express app with JWT auth middleware
- MongoDB (or similar) for data storage
- Socket.io for real-time events

## 2. Models
- User: { id, username, passwordHash, avatar, status, ... }
- Message: { id, chatId, sender, content, file, reactions, replyTo, status, createdAt, updatedAt }
- Group: { id, name, members, avatar, ... }
- Pin, Block, Mute, Reaction, Receipt, Report: { ... }

## 3. REST API Endpoints
- Implement all endpoints from BACKEND_API_SPEC.md
- Use JWT for authentication
- Validate all input
- Return consistent JSON responses

## 4. Socket.io Events
- On connect, authenticate user
- Join user to their DM and group rooms
- Broadcast all real-time events (messages, edits, pins, typing, etc.)
- Sync state on reconnect

## 5. Sync Logic
- On every action (send, edit, pin, block, etc.):
  - Update DB
  - Emit Socket.io event to relevant users
- On reconnect, send missed events

## 6. Localhost & Production
- Use environment variables for DB and server URLs
- Allow CORS for frontend on localhost and production

---

**Next: Frontend refactor plan and code update for universal sync.**
