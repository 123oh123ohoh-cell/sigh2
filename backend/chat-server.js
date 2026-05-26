const express = require('express');
const cors = require('cors');
const http = require('http');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const jwt = require('jsonwebtoken');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

const PORT = Number(process.env.PORT || 5500);
const SECRET = process.env.JWT_SECRET || 'supersecretkey';
const DB_PATH = process.env.DB_PATH || path.resolve(__dirname, '..', 'ownshub.db');

app.use(cors());
app.use(express.json({ limit: '2mb' }));

const db = new sqlite3.Database(DB_PATH);

function initDb() {
  db.serialize(() => {
    db.run(
      `CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE,
        password TEXT
      )`
    );

    db.run(
      `CREATE TABLE IF NOT EXISTS profiles (
        username TEXT PRIMARY KEY,
        displayName TEXT,
        avatar TEXT
      )`
    );

    db.run(
      `CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sender TEXT NOT NULL,
        receiver TEXT NOT NULL,
        content TEXT NOT NULL,
        image TEXT,
        timestamp TEXT NOT NULL
      )`
    );
  });
}

initDb();

function getUserFromAuthHeader(req) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token) {
    return null;
  }

  try {
    const payload = jwt.verify(token, SECRET);
    return payload && payload.username ? payload.username : null;
  } catch {
    return null;
  }
}

function getRequestUsername(req) {
  return (
    req.headers['x-chat-user'] ||
    getUserFromAuthHeader(req) ||
    req.query.me ||
    null
  );
}

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'chat-server' });
});

app.get('/api/users', (_req, res) => {
  const sql = `
    SELECT
      username,
      COALESCE(NULLIF(displayName, ''), username) AS displayName,
      avatar
    FROM (
      SELECT
        u.username AS username,
        p.displayName AS displayName,
        p.avatar AS avatar
      FROM users u
      LEFT JOIN profiles p ON p.username = u.username

      UNION

      SELECT
        p.username AS username,
        p.displayName AS displayName,
        p.avatar AS avatar
      FROM profiles p
      WHERE p.username IS NOT NULL
    ) combined
    WHERE username IS NOT NULL
    ORDER BY username COLLATE NOCASE ASC
  `;

  db.all(sql, [], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: 'DB error', details: err.message });
    }

    res.json(rows || []);
  });
});

app.get('/api/messages', (req, res) => {
  const me = getRequestUsername(req);
  const otherUser = req.query.user;

  if (!me || !otherUser) {
    return res.status(400).json({ error: 'Missing me/user' });
  }

  const sql = `
    SELECT sender, receiver, content, image, timestamp
    FROM messages
    WHERE (sender = ? AND receiver = ?) OR (sender = ? AND receiver = ?)
    ORDER BY id ASC
    LIMIT 500
  `;

  db.all(sql, [me, otherUser, otherUser, me], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: 'DB error', details: err.message });
    }

    res.json(rows || []);
  });
});

app.post('/api/messages', (req, res) => {
  const sender = getRequestUsername(req);
  const { receiver, content, image } = req.body;

  if (!sender || !receiver || (typeof content !== 'string' && typeof image !== 'string')) {
    return res.status(400).json({ error: 'Missing fields' });
  }

  const trimmed = String(content || '').trim();
  if (!trimmed && !image) {
    return res.status(400).json({ error: 'Empty message' });
  }

  const timestamp = new Date().toISOString();
  db.run(
    'INSERT INTO messages (sender, receiver, content, image, timestamp) VALUES (?, ?, ?, ?, ?)',
    [sender, receiver, trimmed, image || null, timestamp],
    function onInsert(err) {
      if (err) {
        return res.status(500).json({ error: 'DB error', details: err.message });
      }

      res.json({
        id: this.lastID,
        sender,
        receiver,
        content: trimmed,
        image: image || null,
        timestamp
      });
    }
  );
});

const userStatus = new Map();
const onlineUsers = new Set();
const socketIdsByUser = new Map();

function roomFor(username) {
  return `user:${username}`;
}

function addUserSocket(username, socketId) {
  const set = socketIdsByUser.get(username) || new Set();
  set.add(socketId);
  socketIdsByUser.set(username, set);
  onlineUsers.add(username);
}

function removeUserSocket(username, socketId) {
  const set = socketIdsByUser.get(username);
  if (!set) {
    return;
  }

  set.delete(socketId);
  if (set.size === 0) {
    socketIdsByUser.delete(username);
    onlineUsers.delete(username);
    userStatus.set(username, 'offline');
  }
}

function emitPresence() {
  io.emit('online_users', Array.from(onlineUsers));
  io.emit('user_status', Object.fromEntries(userStatus));
}

io.on('connection', (socket) => {
  socket.on('join', (username) => {
    if (!username || typeof username !== 'string') {
      return;
    }

    const clean = username.trim();
    if (!clean) {
      return;
    }

    socket.data.username = clean;
    socket.join(roomFor(clean));
    addUserSocket(clean, socket.id);

    if (!userStatus.has(clean) || userStatus.get(clean) === 'offline') {
      userStatus.set(clean, 'online');
    }

    emitPresence();
  });

  socket.on('get_online_users', () => {
    socket.emit('online_users', Array.from(onlineUsers));
    socket.emit('user_status', Object.fromEntries(userStatus));
  });

  socket.on('set_status', (data) => {
    const username = socket.data.username || (data && data.username);
    const status = data && data.status;
    if (!username || !status) {
      return;
    }

    userStatus.set(username, String(status));
    emitPresence();
  });

  socket.on('typing', (data) => {
    if (!data || !data.to) {
      return;
    }

    io.to(roomFor(String(data.to))).emit('typing', {
      to: String(data.to),
      from: String(data.from || socket.data.username || 'Unknown')
    });
  });

  socket.on('private_message', (msg, ack) => {
    if (!msg || !msg.receiver) {
      if (ack) ack('error');
      return;
    }

    const sender = String(msg.sender || socket.data.username || '').trim();
    const receiver = String(msg.receiver || '').trim();
    const content = String(msg.content || '').trim();
    const image = typeof msg.image === 'string' ? msg.image : null;
    const gif = typeof msg.gif === 'string' ? msg.gif : null;

    if (!sender || !receiver || (!content && !image && !gif)) {
      if (ack) ack('error');
      return;
    }

    const saved = {
      sender,
      receiver,
      content,
      image,
      gif,
      timestamp: new Date().toISOString()
    };

    db.run(
      'INSERT INTO messages (sender, receiver, content, image, timestamp) VALUES (?, ?, ?, ?, ?)',
      [saved.sender, saved.receiver, saved.content, saved.image || saved.gif || null, saved.timestamp],
      () => {
        io.to(roomFor(saved.sender)).emit('private_message', saved);
        if (saved.receiver !== saved.sender) {
          io.to(roomFor(saved.receiver)).emit('private_message', saved);
        }
        if (ack) ack('ok');
      }
    );
  });

  socket.on('disconnect', () => {
    const username = socket.data.username;
    if (!username) {
      return;
    }

    removeUserSocket(username, socket.id);
    emitPresence();
  });
});

const os = require('os');
function getLocalIp() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}
server.listen(PORT, () => {
  const ip = getLocalIp();
  console.log(`Chat server listening on:`);
  console.log(`  Local:   http://localhost:${PORT}`);
  console.log(`  Network: http://${ip}:${PORT}`);
  console.log('Use the Network address from other devices on your LAN.');
});
