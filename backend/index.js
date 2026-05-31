// ─── START SERVER ─────────────────────────────────────────────
server.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});
// ─── PERSISTENT STORAGE CHECK ─────────────────────────────
const fs = require('fs');
const DATA_PATH = './data';
try {
  if (!fs.existsSync(DATA_PATH)) {
    fs.mkdirSync(DATA_PATH, { recursive: true });
    console.log('Created ./data directory for persistent storage.');
  }
  fs.accessSync(DATA_PATH, fs.constants.W_OK);
} catch (e) {
  console.warn('WARNING: ./data directory is not writable or could not be created. Persistent storage may not work!');
}

// ─── IMPORTS ────────────────────────────────────────────────
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Database = require('better-sqlite3');

const http = require('http');
const { Server } = require('socket.io');
const os = require('os');

// ─── APP & SERVER ───────────────────────────────────────────


const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

// ─── AUTHENTICATION MIDDLEWARE ─────────────────────────────
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token provided' });
  jwt.verify(token, SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid token' });
    req.user = user;
    next();
  });
}

// ─── ONLINE USERS & STATUS ─────────────────────────────────
const onlineUsers = new Set();
const userStatus = {};

// ─── SOCKET.IO HANDLERS ─────────────────────────────────────
io.on('connection', (socket) => {
  let username;
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

  // Real-time group message support
  socket.on('group_message', (msg) => {
    const timestamp = msg.timestamp || new Date().toISOString();
    // Save to DB (store group as receiver)
    db.run(
      'INSERT INTO messages (sender, receiver, content, image, gif, timestamp) VALUES (?, ?, ?, ?, ?, ?)',
      [msg.sender, msg.group, msg.content || '', msg.image || null, msg.gif || null, timestamp],
      () => {}
    );
    // Broadcast to all in group except sender
    socket.broadcast.emit('group_message', { ...msg, timestamp });
    // Optionally, echo to sender as well:
    socket.emit('group_message', { ...msg, timestamp });
  });
});


app.use(cors());
app.use(express.json({ limit: '10mb' }));

// ─── DATABASES ────────────────────────────────────────────────
const dbSigh2 = new Database('./data/sigh2.db');
const dbOwnshub = new Database('./data/ownshub.db');

// Use ownshub DB for user/profile/message endpoints
const db = dbOwnshub;


// ─── HEALTH ENDPOINT FOR STORAGE ──────────────────────────
app.get('/api/storage-health', (req, res) => {
  try {
    const sigh2Exists = fs.existsSync('/data/sigh2.db');
    const ownshubExists = fs.existsSync('/data/ownshub.db');
    fs.accessSync('/data', fs.constants.W_OK);
    res.json({
      sigh2Db: sigh2Exists ? 'exists' : 'missing',
      ownshubDb: ownshubExists ? 'exists' : 'missing',
      dataDir: 'writable',
      status: (sigh2Exists && ownshubExists) ? 'ok' : 'missing-db'
    });
  } catch (e) {
    res.status(500).json({ error: 'Storage not writable or missing', details: e.message });
  }
});

// Helper: run on both DBs for writes
function runOnBothDbs(sql, params) {
  dbSigh2.prepare(sql).run(...params);
  dbOwnshub.prepare(sql).run(...params);
}
// Helper: get from sigh2, fallback to ownshub
function getFromDbs(sql, params) {
  let row = dbSigh2.prepare(sql).get(...params);
  if (!row) row = dbOwnshub.prepare(sql).get(...params);
  return row;
}
// Helper: all from sigh2, fallback to ownshub
function allFromDbs(sql, params) {
  let rows = dbSigh2.prepare(sql).all(...params);
  if (!rows || !rows.length) rows = dbOwnshub.prepare(sql).all(...params);
  return rows;
}

// ─── GROUPS ─────────────────────────────────────────────────
// Create tables in both DBs
try {
  [dbSigh2, dbOwnshub].forEach(db => {
    db.prepare(`CREATE TABLE IF NOT EXISTS groups (
      id TEXT PRIMARY KEY,
      name TEXT,
      members TEXT,
      creator TEXT,
      createdAt TEXT
    )`).run();
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
  });
} catch (e) { console.error('DB migration error (all):', e); }


// Health check endpoint
app.get('/api/health', (req, res) => {
  let sigh2Ok = false, ownshubOk = false;
  try { dbSigh2.prepare('SELECT 1').get(); sigh2Ok = true; } catch {}
  try { dbOwnshub.prepare('SELECT 1').get(); ownshubOk = true; } catch {}
  res.json({ sigh2: sigh2Ok, ownshub: ownshubOk, status: (sigh2Ok && ownshubOk) ? 'healthy' : (sigh2Ok || ownshubOk) ? 'degraded' : 'down' });
});

// Get all groups
app.get('/api/groups', (req, res) => {
  try {
    const rows = allFromDbs('SELECT * FROM groups ORDER BY createdAt DESC', []);
    // Parse members JSON for each group
    const groups = rows.map(g => ({ ...g, members: JSON.parse(g.members || '[]') }));
    res.json(groups);
  } catch (err) {
    return res.status(500).json({ error: 'DB error' });
  }
});

// Create a new group
app.post('/api/groups', (req, res) => {
  const { id, name, members, creator } = req.body;
  if (!id || !name || !Array.isArray(members) || !members.length) {
    return res.status(400).json({ error: 'Missing fields' });
  }
  const createdAt = new Date().toISOString();
  try {
    runOnBothDbs('INSERT OR IGNORE INTO groups (id, name, members, creator, createdAt) VALUES (?, ?, ?, ?, ?)', [id, name, JSON.stringify(members), creator || members[0], createdAt]);
    // Emit group_create event to all sockets
    io.emit('group_create', { id, name, members, creator: creator || members[0], createdAt });
    res.json({ id, name, members, creator: creator || members[0], createdAt });
  } catch (err) {
    return res.status(500).json({ error: 'DB error' });
  }
});


app.post('/api/login', (req, res) => {
  const { username, password, device } = req.body;
  try {
    const row = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
    if (!row) return res.status(401).json({ error: 'Invalid credentials' });
    if (!bcrypt.compareSync(password, row.password)) return res.status(401).json({ error: 'Invalid credentials' });
    // Update last login and device info in profile
    try {
      db.prepare('UPDATE profiles SET lastLogin = ?, lastDevice = ? WHERE username = ?')
        .run(new Date().toISOString(), device && device.deviceType ? device.deviceType : '', username);
    } catch {}
    const token = jwt.sign({ username }, SECRET, { expiresIn: '7d' });
    res.json({ token, username });
  } catch (err) {
    return res.status(500).json({ error: 'DB error' });
  }
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
  try {
    let row;
    let user = username;
    if (!user && req.headers['authorization']) {
      // Try to get from token
      return authenticateToken(req, res, () => {
        try {
          user = req.user.username;
          row = db.prepare('SELECT * FROM profiles WHERE username = ?').get(user);
          if (!row) {
            // Auto-create profile if missing
            db.prepare('INSERT INTO profiles (username, displayName, registeredAt) VALUES (?, ?, ?)')
              .run(user, user, new Date().toISOString());
            row = db.prepare('SELECT * FROM profiles WHERE username = ?').get(user);
          }
          res.json(row || {});
        } catch (err) {
          return res.status(500).json({ error: 'DB error' });
        }
      });
    } else if (user) {
      row = db.prepare('SELECT * FROM profiles WHERE username = ?').get(user);
      if (!row) {
        // Auto-create profile if missing
        db.prepare('INSERT INTO profiles (username, displayName, registeredAt) VALUES (?, ?, ?)')
          .run(user, user, new Date().toISOString());
        row = db.prepare('SELECT * FROM profiles WHERE username = ?').get(user);
      }
      res.json(row || {});
    } else {
      return res.status(400).json({ error: 'No user specified' });
    }
  } catch (err) {
    return res.status(500).json({ error: 'DB error' });
  }
});

app.post('/api/profile', authenticateToken, (req, res) => {
  const username = req.user.username;
  let { displayName, pronouns, customPronouns, bio, avatar, premiumTier } = req.body;
  // Normalize and trim input
  if (typeof displayName === 'string') displayName = displayName.trim();
  if (typeof pronouns === 'string') pronouns = pronouns.trim().toLowerCase();
  if (typeof customPronouns === 'string') customPronouns = customPronouns.trim();
  if (typeof bio === 'string') bio = bio.trim();
  // Input validation
  if (displayName !== undefined && (typeof displayName !== 'string' || displayName.length < 1 || displayName.length > 64 || !displayName.replace(/\s/g, ''))) {
    return res.status(400).json({ error: 'Display name must be 1-64 non-whitespace characters.' });
  }
  if (bio !== undefined && (typeof bio !== 'string' || bio.length > 512)) {
    return res.status(400).json({ error: 'Bio must be 512 characters or less.' });
  }
  if (pronouns !== undefined && (typeof pronouns !== 'string' || pronouns.length > 32)) {
    return res.status(400).json({ error: 'Pronouns must be 32 characters or less.' });
  }
  if (customPronouns !== undefined && (typeof customPronouns !== 'string' || customPronouns.length > 32)) {
    return res.status(400).json({ error: 'Custom pronouns must be 32 characters or less.' });
  }
  try {
    // Always preserve current followers/following counts
    const row = db.prepare('SELECT * FROM profiles WHERE username = ?').get(username);
    const followers = row ? row.followers || 0 : 0;
    const following = row ? row.following || 0 : 0;
    // Only update fields that are provided and different, never overwrite with undefined/null
    const updateFields = [];
    const updateValues = [];
    if (row) {
      if (displayName !== undefined && displayName !== row.displayName) { updateFields.push('displayName = ?'); updateValues.push(displayName); }
      if (pronouns !== undefined && pronouns !== row.pronouns) { updateFields.push('pronouns = ?'); updateValues.push(pronouns); }
      if (customPronouns !== undefined && customPronouns !== row.customPronouns) { updateFields.push('customPronouns = ?'); updateValues.push(customPronouns); }
      if (bio !== undefined && bio !== row.bio) { updateFields.push('bio = ?'); updateValues.push(bio); }
      if (avatar !== undefined && avatar !== row.avatar) { updateFields.push('avatar = ?'); updateValues.push(avatar); }
      if (premiumTier !== undefined && premiumTier !== row.premiumTier) { updateFields.push('premiumTier = ?'); updateValues.push(premiumTier); }
      // Always update followers/following to DB value
      updateFields.push('followers = ?'); updateValues.push(followers);
      updateFields.push('following = ?'); updateValues.push(following);
      updateFields.push('lastLogin = NULL');
      updateFields.push('lastDevice = NULL');
      updateFields.push('registeredAt = COALESCE(registeredAt, ?)'); updateValues.push(new Date().toISOString());
      if (updateFields.length > 0) {
        db.prepare(`UPDATE profiles SET ${updateFields.join(', ')} WHERE username = ?`).run(...updateValues, username);
      }
    } else {
      // Insert new profile
      db.prepare(`INSERT INTO profiles (username, displayName, pronouns, customPronouns, bio, avatar, followers, following, premiumTier, lastLogin, lastDevice, registeredAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?)
      `).run(
        username,
        displayName || '',
        pronouns || '',
        customPronouns || '',
        bio || '',
        avatar || '',
        followers,
        following,
        premiumTier || null,
        new Date().toISOString()
      );
    }
    // Return the latest profile data after save
    const updated = db.prepare('SELECT * FROM profiles WHERE username = ?').get(username);
    res.json({ success: true, profile: updated });
  } catch (err) {
    return res.status(500).json({ error: 'DB error' });
  }
});

// Follow / Unfollow
app.post('/api/follow', authenticateToken, (req, res) => {
  const follower = req.user.username;
  const { followee } = req.body;
  if (!followee || follower === followee) return res.status(400).json({ error: 'Invalid' });
  try {
    db.prepare('UPDATE profiles SET following = following + 1 WHERE username = ?').run(follower);
    db.prepare('UPDATE profiles SET followers = followers + 1 WHERE username = ?').run(followee);
    res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: 'DB error' });
  }
});

app.post('/api/unfollow', authenticateToken, (req, res) => {
  const follower = req.user.username;
  const { followee } = req.body;
  if (!followee || follower === followee) return res.status(400).json({ error: 'Invalid' });
  try {
    db.prepare('UPDATE profiles SET following = MAX(following-1,0) WHERE username = ?').run(follower);
    db.prepare('UPDATE profiles SET followers = MAX(followers-1,0) WHERE username = ?').run(followee);
    res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: 'DB error' });
  }
});

// Arts

app.get('/api/arts', (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM arts ORDER BY id DESC').all();
    res.json(rows);
  } catch (err) {
    return res.status(500).json({ error: 'DB error' });
  }
});

app.post('/api/arts', authenticateToken, (req, res) => {
  const username = req.user.username;
  const { image, title, description, category } = req.body;
  if (!image || !title || !category) return res.status(400).json({ error: 'Missing fields' });
  const date = new Date().toLocaleString();
  try {
    const info = db.prepare('INSERT INTO arts (username, image, title, description, category, date) VALUES (?, ?, ?, ?, ?, ?)')
      .run(username, image, title, description, category, date);
    res.json({ id: info.lastInsertRowid, username, image, title, description, category, date });
  } catch (err) {
    return res.status(500).json({ error: 'DB error' });
  }
});

app.delete('/api/arts/:id', authenticateToken, (req, res) => {
  const username = req.user.username;
  try {
    const row = db.prepare('SELECT username FROM arts WHERE id = ?').get(req.params.id);
    if (!row) return res.status(404).json({ error: 'Not found' });
    if (row.username !== username) return res.status(403).json({ error: 'Not authorized' });
    db.prepare('DELETE FROM arts WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: 'DB error' });
  }
});

app.get('/api/hijab-arts', (req, res) => {
  try {
    const rows = db.prepare("SELECT * FROM arts WHERE category = 'Hijab' ORDER BY id DESC").all();
    res.json(rows);
  } catch (err) {
    return res.status(500).json({ error: 'DB error' });
  }
});

// Comments
app.post('/api/comments', (req, res) => {
  const { videoId, text, username } = req.body;
  if (!videoId || !text) return res.status(400).json({ error: 'Missing fields' });
  const date = new Date().toLocaleString();
  try {
    const info = db.prepare('INSERT INTO comments (videoId, username, text, date) VALUES (?, ?, ?, ?)')
      .run(videoId, username || 'Anonymous', text, date);
    res.json({ id: info.lastInsertRowid, videoId, username, text, date });
  } catch (err) {
    return res.status(500).json({ error: 'DB error' });
  }
});

app.get('/api/comments/:videoId', (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM comments WHERE videoId = ? ORDER BY id DESC').all(req.params.videoId);
    res.json(rows);
  } catch (err) {
    return res.status(500).json({ error: 'DB error' });
  }
});

// Premium
app.post('/api/premium', authenticateToken, (req, res) => {
  const { premiumTier } = req.body;
  if (!premiumTier) return res.status(400).json({ error: 'Missing premiumTier' });
  try {
    db.prepare('UPDATE profiles SET premiumTier = ? WHERE username = ?').run(premiumTier, req.user.username);
    res.json({ success: true, premiumTier });
  } catch (err) {
    return res.status(500).json({ error: 'DB error' });
  }
});

// ─── START SERVER ─────────────────────────────────────────────
server.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});