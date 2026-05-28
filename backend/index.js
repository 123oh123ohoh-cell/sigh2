const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Database = require('better-sqlite3');
const http = require('http');
const { Server } = require('socket.io');
const os = require('os');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

const PORT = process.env.PORT || 5500;
const SECRET = process.env.JWT_SECRET || 'supersecretkey';

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// ─── DATABASE ─────────────────────────────────────────────────
const db = new Database('./ownshub.db');

// Table creation and migrations
try {
  db.prepare(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    password TEXT
  )`).run();
  db.prepare(`CREATE TABLE IF NOT EXISTS profiles (
    username TEXT PRIMARY KEY,
    displayName TEXT,
    pronouns TEXT,
    customPronouns TEXT,
    bio TEXT,
    avatar TEXT,
    followers INTEGER DEFAULT 0,
    following INTEGER DEFAULT 0,
    premiumTier TEXT DEFAULT NULL
  )`).run();
  db.prepare(`CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sender TEXT,
    receiver TEXT,
    content TEXT,
    image TEXT,
    gif TEXT,
    timestamp TEXT
  )`).run();
  db.prepare(`CREATE TABLE IF NOT EXISTS arts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT,
    image TEXT,
    title TEXT,
    description TEXT,
    category TEXT,
    date TEXT
  )`).run();
  db.prepare(`CREATE TABLE IF NOT EXISTS comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    videoId INTEGER,
    username TEXT,
    text TEXT,
    date TEXT
  )`).run();
  // Migrations (safe to run every time)
  try { db.prepare('ALTER TABLE profiles ADD COLUMN followers INTEGER DEFAULT 0').run(); } catch {}
  try { db.prepare('ALTER TABLE profiles ADD COLUMN following INTEGER DEFAULT 0').run(); } catch {}
  try { db.prepare('ALTER TABLE profiles ADD COLUMN premiumTier TEXT DEFAULT NULL').run(); } catch {}
  try { db.prepare('ALTER TABLE arts ADD COLUMN category TEXT').run(); } catch {}
  try { db.prepare('ALTER TABLE messages ADD COLUMN image TEXT').run(); } catch {}
  try { db.prepare('ALTER TABLE messages ADD COLUMN gif TEXT').run(); } catch {}
} catch (e) { console.error('DB migration error:', e); }

// ─── AUTH HELPER ──────────────────────────────────────────────
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token' });
  jwt.verify(token, SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid token' });
    req.user = user;
    next();
  });
}

// ─── SOCKET.IO ────────────────────────────────────────────────
const userStatus = {};
const onlineUsers = new Set();

io.on('connection', (socket) => {
  let username = null;

  socket.on('join', (user) => {
    username = user;
    if (username) {
      onlineUsers.add(username);
      socket.join(username);
      if (!userStatus[username]) userStatus[username] = 'online';
      io.emit('online_users', Array.from(onlineUsers));
      io.emit('user_status', userStatus);
    }
  });

  socket.on('disconnect', () => {
    if (username) {
      onlineUsers.delete(username);
      userStatus[username] = 'offline';
      io.emit('online_users', Array.from(onlineUsers));
      io.emit('user_status', userStatus);
    }
  });

  socket.on('get_online_users', () => {
    socket.emit('online_users', Array.from(onlineUsers));
    socket.emit('user_status', userStatus);
  });

  socket.on('set_status', (data) => {
    if (data.username && data.status) {
      userStatus[data.username] = data.status;
      io.emit('user_status', userStatus);
    }
  });

  socket.on('typing', (data) => {
    if (data.to) io.to(data.to).emit('typing', data);
  });

  socket.on('private_message', (msg) => {
    const timestamp = msg.timestamp || new Date().toISOString();
    // Save to DB
    db.run(
      'INSERT INTO messages (sender, receiver, content, image, gif, timestamp) VALUES (?, ?, ?, ?, ?, ?)',
      [msg.sender, msg.receiver, msg.content || '', msg.image || null, msg.gif || null, timestamp],
      () => {}
    );
    // Deliver to recipient and sender
    io.to(msg.receiver).emit('private_message', { ...msg, timestamp });
    io.to(msg.sender).emit('private_message', { ...msg, timestamp });
  });
});

// ─── ROUTES ───────────────────────────────────────────────────

app.get('/', (req, res) => res.send('OwnsHub Backend API running!'));

// Auth
app.post('/api/signup', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Missing fields' });
  db.get('SELECT * FROM users WHERE username = ?', [username], (err, row) => {
    if (row) return res.status(409).json({ error: 'Username exists' });
    const hash = bcrypt.hashSync(password, 10);
    db.run('INSERT INTO users (username, password) VALUES (?, ?)', [username, hash], function(err) {
      if (err) return res.status(500).json({ error: 'DB error' });
      const token = jwt.sign({ username }, SECRET, { expiresIn: '7d' });
      res.json({ token, username });
    });
  });
});

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  db.get('SELECT * FROM users WHERE username = ?', [username], (err, row) => {
    if (!row) return res.status(401).json({ error: 'Invalid credentials' });
    if (!bcrypt.compareSync(password, row.password)) return res.status(401).json({ error: 'Invalid credentials' });
    const token = jwt.sign({ username }, SECRET, { expiresIn: '7d' });
    res.json({ token, username });
  });
});

// Users list (for chat sidebar)
app.get('/api/users', (req, res) => {
  try {
    const rows = db.prepare('SELECT u.username, p.displayName, p.avatar FROM users u LEFT JOIN profiles p ON u.username = p.username').all();
    res.json(rows.map(r => ({
      username: r.username,
      displayName: r.displayName || r.username,
      avatar: r.avatar || null
    })));
  } catch (err) {
    return res.status(500).json({ error: 'DB error' });
  }
});

// Messages
app.get('/api/messages', authenticateToken, (req, res) => {
  const me = req.user.username;
  const other = req.query.user;
  if (!other) return res.status(400).json({ error: 'Missing user param' });
  try {
    const rows = db.prepare(`SELECT * FROM messages WHERE (sender=? AND receiver=?) OR (sender=? AND receiver=?) ORDER BY id ASC`).all(me, other, other, me);
    res.json(rows);
  } catch (err) {
    return res.status(500).json({ error: 'DB error' });
  }
});

app.post('/api/messages', authenticateToken, (req, res) => {
  const sender = req.user.username;
  const { receiver, content, image, gif } = req.body;
  if (!receiver) return res.status(400).json({ error: 'Missing receiver' });
  const timestamp = new Date().toISOString();
  try {
    const stmt = db.prepare('INSERT INTO messages (sender, receiver, content, image, gif, timestamp) VALUES (?, ?, ?, ?, ?, ?)');
    const info = stmt.run(sender, receiver, content || '', image || null, gif || null, timestamp);
    res.json({ id: info.lastInsertRowid, sender, receiver, content, image, gif, timestamp });
  } catch (err) {
    return res.status(500).json({ error: 'DB error' });
  }
});

// Profile
app.get('/api/profile', (req, res) => {
  const username = req.query.user;
  if (username) {
    db.get('SELECT displayName, pronouns, customPronouns, bio, avatar, followers, following, premiumTier FROM profiles WHERE username = ?', [username], (err, row) => {
      if (err) return res.status(500).json({ error: 'DB error' });
      res.json(row || {});
    });
  } else {
    authenticateToken(req, res, () => {
      db.get('SELECT displayName, pronouns, customPronouns, bio, avatar, followers, following, premiumTier FROM profiles WHERE username = ?', [req.user.username], (err, row) => {
        if (err) return res.status(500).json({ error: 'DB error' });
        res.json(row || {});
      });
    });
  }
});

app.post('/api/profile', authenticateToken, (req, res) => {
  const username = req.user.username;
  const { displayName, pronouns, customPronouns, bio, avatar, premiumTier } = req.body;
  db.get('SELECT followers, following FROM profiles WHERE username = ?', [username], (err, row) => {
    const followers = row ? row.followers || 0 : 0;
    const following = row ? row.following || 0 : 0;
    db.run(
      `INSERT INTO profiles (username, displayName, pronouns, customPronouns, bio, avatar, followers, following, premiumTier)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(username) DO UPDATE SET displayName=excluded.displayName, pronouns=excluded.pronouns,
       customPronouns=excluded.customPronouns, bio=excluded.bio, avatar=excluded.avatar, premiumTier=excluded.premiumTier`,
      [username, displayName, pronouns, customPronouns, bio, avatar, followers, following, premiumTier],
      function(err) {
        if (err) return res.status(500).json({ error: 'DB error', details: err.message });
        res.json({ success: true });
      }
    );
  });
});

// Follow / Unfollow
app.post('/api/follow', authenticateToken, (req, res) => {
  const follower = req.user.username;
  const { followee } = req.body;
  if (!followee || follower === followee) return res.status(400).json({ error: 'Invalid' });
  db.run('UPDATE profiles SET following = following + 1 WHERE username = ?', [follower], () => {
    db.run('UPDATE profiles SET followers = followers + 1 WHERE username = ?', [followee], () => {
      res.json({ success: true });
    });
  });
});

app.post('/api/unfollow', authenticateToken, (req, res) => {
  const follower = req.user.username;
  const { followee } = req.body;
  if (!followee || follower === followee) return res.status(400).json({ error: 'Invalid' });
  db.run('UPDATE profiles SET following = MAX(following-1,0) WHERE username = ?', [follower], () => {
    db.run('UPDATE profiles SET followers = MAX(followers-1,0) WHERE username = ?', [followee], () => {
      res.json({ success: true });
    });
  });
});

// Arts
app.get('/api/arts', (req, res) => {
  db.all('SELECT * FROM arts ORDER BY id DESC', (err, rows) => {
    if (err) return res.status(500).json({ error: 'DB error' });
    res.json(rows);
  });
});

app.post('/api/arts', authenticateToken, (req, res) => {
  const username = req.user.username;
  const { image, title, description, category } = req.body;
  if (!image || !title || !category) return res.status(400).json({ error: 'Missing fields' });
  const date = new Date().toLocaleString();
  db.run('INSERT INTO arts (username, image, title, description, category, date) VALUES (?, ?, ?, ?, ?, ?)',
    [username, image, title, description, category, date], function(err) {
      if (err) return res.status(500).json({ error: 'DB error' });
      res.json({ id: this.lastID, username, image, title, description, category, date });
    });
});

app.delete('/api/arts/:id', authenticateToken, (req, res) => {
  const username = req.user.username;
  db.get('SELECT username FROM arts WHERE id = ?', [req.params.id], (err, row) => {
    if (!row) return res.status(404).json({ error: 'Not found' });
    if (row.username !== username) return res.status(403).json({ error: 'Not authorized' });
    db.run('DELETE FROM arts WHERE id = ?', [req.params.id], () => res.json({ success: true }));
  });
});

app.get('/api/hijab-arts', (req, res) => {
  db.all("SELECT * FROM arts WHERE category = 'Hijab' ORDER BY id DESC", (err, rows) => {
    if (err) return res.status(500).json({ error: 'DB error' });
    res.json(rows);
  });
});

// Comments
app.post('/api/comments', (req, res) => {
  const { videoId, text, username } = req.body;
  if (!videoId || !text) return res.status(400).json({ error: 'Missing fields' });
  const date = new Date().toLocaleString();
  db.run('INSERT INTO comments (videoId, username, text, date) VALUES (?, ?, ?, ?)',
    [videoId, username || 'Anonymous', text, date], function(err) {
      if (err) return res.status(500).json({ error: 'DB error' });
      res.json({ id: this.lastID, videoId, username, text, date });
    });
});

app.get('/api/comments/:videoId', (req, res) => {
  db.all('SELECT * FROM comments WHERE videoId = ? ORDER BY id DESC', [req.params.videoId], (err, rows) => {
    if (err) return res.status(500).json({ error: 'DB error' });
    res.json(rows);
  });
});

// Premium
app.post('/api/premium', authenticateToken, (req, res) => {
  const { premiumTier } = req.body;
  if (!premiumTier) return res.status(400).json({ error: 'Missing premiumTier' });
  db.run('UPDATE profiles SET premiumTier = ? WHERE username = ?', [premiumTier, req.user.username], function(err) {
    if (err) return res.status(500).json({ error: 'DB error' });
    res.json({ success: true, premiumTier });
  });
});

// ─── START SERVER ─────────────────────────────────────────────
server.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});