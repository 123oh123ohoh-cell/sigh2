# Chat App Backend API & Socket.io Spec

## REST API Endpoints

### Auth
- `POST /api/auth/login` — Login, returns token
- `POST /api/auth/register` — Register, returns token

### Users
- `GET /api/users/me` — Get current user info
- `GET /api/users/:id` — Get user profile
- `PUT /api/users/:id` — Update user profile

### Messages
- `GET /api/messages?chatId=...` — Get messages for DM or group
- `POST /api/messages` — Send message (DM or group)
- `PUT /api/messages/:id` — Edit message
- `DELETE /api/messages/:id` — Delete message

### Groups
- `GET /api/groups` — List groups user is in
- `POST /api/groups` — Create group
- `PUT /api/groups/:id` — Update group (name, members)
- `DELETE /api/groups/:id` — Delete group

### Pins
- `GET /api/pins?chatId=...` — Get pinned messages
- `POST /api/pins` — Pin message
- `DELETE /api/pins/:id` — Unpin message

### Blocks/Mutes
- `GET /api/blocks` — List blocked users
- `POST /api/blocks` — Block user
- `DELETE /api/blocks/:id` — Unblock user
- `GET /api/mutes` — List muted users
- `POST /api/mutes` — Mute user
- `DELETE /api/mutes/:id` — Unmute user

### Reactions
- `POST /api/reactions` — Add reaction
- `DELETE /api/reactions/:id` — Remove reaction

### Read Receipts
- `POST /api/receipts` — Mark message as read
- `GET /api/receipts?chatId=...` — Get read receipts

### Reports
- `POST /api/reports` — Report user/message

---

## Socket.io Events
- `join` — Join user to server
- `private_message` — Send/receive DM
- `group_message` — Send/receive group message
- `edit_message` — Edit message
- `delete_message` — Delete message
- `reaction` — Add/remove reaction
- `typing` — Typing indicator
- `read_receipt` — Read receipt
- `pin` — Pin/unpin message
- `block` — Block/unblock user
- `mute` — Mute/unmute user
- `group_update` — Group changes
- `user_status` — Online/away/dnd

---

## Notes
- All endpoints require authentication (token or session).
- All data should be stored per user and per chat (DM or group).
- All actions should update both backend and localStorage on the frontend, and merge on reconnect.
- Use Socket.io for real-time updates for all features.

---

**Next: Node.js/Express backend implementation outline and frontend refactor plan.**
