
const mongoose = require('mongoose');
require('dotenv').config();

// --- Mongoose Models ---
const userSchema = new mongoose.Schema({
  username: { type: String, unique: true, required: true },
  password: { type: String, required: true }
});
const User = mongoose.model('User', userSchema);

const profileSchema = new mongoose.Schema({
  username: { type: String, unique: true, required: true },
  displayName: String,
  pronouns: String,
  customPronouns: String,
  bio: String,
  avatar: String,
  followers: { type: Number, default: 0 },
  following: { type: Number, default: 0 }
});
const Profile = mongoose.model('Profile', profileSchema);

const artSchema = new mongoose.Schema({
  username: String,
  image: String,
  title: String,
  description: String,
  date: String,
  tags: String
});
const Art = mongoose.model('Art', artSchema);

const messageSchema = new mongoose.Schema({
  sender: String,
  receiver: String,
  content: String,
  timestamp: String
});
const Message = mongoose.model('Message', messageSchema);

const commentSchema = new mongoose.Schema({
  videoId: String,
  username: String,
  text: String,
  date: String
});
const Comment = mongoose.model('Comment', commentSchema);

const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/ownshub');

const db = mongoose.connection;
db.on('error', console.error.bind(console, 'MongoDB connection error:'));
db.once('open', () => {
  console.log('Connected to MongoDB');
});

const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require('socket.io');



// Leaderboard: Get all users sorted by followers (descending)
app.get('/api/leaderboard', async (req, res) => {
  try {
    const profiles = await Profile.find({}, 'username displayName avatar followers').sort({ followers: -1, username: 1 });
    res.json(profiles);
  } catch (err) {
    res.status(500).json({ error: 'DB error' });
  }
});
// --- Chat Messages Endpoints ---
// Get chat history with a user (auth required)
app.get('/api/messages', authenticateToken, async (req, res) => {
  const user1 = req.user.username;
  const user2 = req.query.user;
  if (!user2) return res.status(400).json({ error: 'Missing user' });
  try {
    const messages = await Message.find({
      $or: [
        { sender: user1, receiver: user2 },
        { sender: user2, receiver: user1 }
      ]
    }).sort({ _id: 1 });
    res.json(messages);
  } catch (err) {
    res.status(500).json({ error: 'DB error' });
  }
});
// Send a message (auth required)
app.post('/api/messages', authenticateToken, async (req, res) => {
  const sender = req.user.username;
  const { receiver, content } = req.body;
  if (!receiver || !content) return res.status(400).json({ error: 'Missing fields' });
  const timestamp = new Date().toISOString();
  try {
    const message = new Message({ sender, receiver, content, timestamp });
    await message.save();
    res.json(message);
  } catch (err) {
    res.status(500).json({ error: 'DB error' });
  }
});
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});
const PORT = 3001;
const SECRET = 'supersecretkey';

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// All route definitions must be below this point

// --- Socket.io Online Status & User Status ---
const userStatus = {};
const onlineUsers = new Set();
io.on('connection', (socket) => {
  let username = null;
  socket.on('join', (user) => {
    username = user;
    if (username) {
      onlineUsers.add(username);
      if (!userStatus[username]) userStatus[username] = 'online';
      io.emit('online_users', Array.from(onlineUsers));
      io.emit('user_status', userStatus);
    }
  });
  socket.on('disconnect', () => {
    if (username) {
      onlineUsers.delete(username);
      io.emit('online_users', Array.from(onlineUsers));
      userStatus[username] = 'offline';
      io.emit('user_status', userStatus);
    }
  });
  socket.on('get_online_users', () => {
    socket.emit('online_users', Array.from(onlineUsers));
    socket.emit('user_status', userStatus);
  });
  // Typing indicator event
  socket.on('typing', (data) => {
    for (const [id, s] of io.of('/').sockets) {
      if (s !== socket && s.handshake && s.handshake.auth && s.handshake.auth.username === data.to) {
        s.emit('typing', data);
      }
    }
    io.emit('typing', data);
  });
  // Set user status
  socket.on('set_status', (data) => {
    // data: { username, status }
    if (data.username && data.status) {
      userStatus[data.username] = data.status;
      io.emit('user_status', userStatus);
    }
  });
});

// Root route for API status
app.get('/', (req, res) => {
  res.send('Welcome to the OwnsHub Backend API!');
});
// Follow a user
app.post('/api/follow', authenticateToken, async (req, res) => {
  const follower = req.user.username;
  const { followee } = req.body;
  if (!followee || follower === followee) return res.status(400).json({ error: 'Invalid followee' });
  try {
    await Profile.updateOne({ username: follower }, { $inc: { following: 1 } });
    await Profile.updateOne({ username: followee }, { $inc: { followers: 1 } });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'DB error' });
  }
});

// Unfollow a user
app.post('/api/unfollow', authenticateToken, async (req, res) => {
  const follower = req.user.username;
  const { followee } = req.body;
  if (!followee || follower === followee) return res.status(400).json({ error: 'Invalid followee' });
  try {
    await Profile.updateOne({ username: follower, following: { $gt: 0 } }, { $inc: { following: -1 } });
    await Profile.updateOne({ username: followee, followers: { $gt: 0 } }, { $inc: { followers: -1 } });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'DB error' });
  }
});





  // Get all art posts
  app.get('/api/arts', async (req, res) => {
    try {
      const arts = await Art.find({}).sort({ _id: -1 });
      res.json(arts);
    } catch (err) {
      res.status(500).json({ error: 'DB error' });
    }
  });

  // Post new art (auth required)
  app.post('/api/arts', authenticateToken, async (req, res) => {
    const username = req.user.username;
    const { image, title, description, tags } = req.body;
    if (!image || !title) return res.status(400).json({ error: 'Missing fields' });
    const date = new Date().toLocaleString();
    try {
      const art = new Art({ username, image, title, description, date, tags });
      await art.save();
      res.json(art);
    } catch (err) {
      res.status(500).json({ error: 'DB error' });
    }
  });


// Post new art (auth required)
app.post('/api/art', authenticateToken, (req, res) => {
  const username = req.user.username;
  const { image, title, description } = req.body;
  if (!image || !title) return res.status(400).json({ error: 'Missing fields' });
  const date = new Date().toLocaleString();
  db.run('INSERT INTO art_posts (username, image, title, description, date) VALUES (?, ?, ?, ?, ?)', [username, image, title, description, date], function(err) {
    if (err) return res.status(500).json({ error: 'DB error' });
    res.json({ id: this.lastID, username, image, title, description, date });
  });
});
// Get profile (auth required for own, public for ?user=)
app.get('/api/profile', async (req, res) => {
  const username = req.query.user;
  try {
    if (username) {
      // Public profile view
      const profile = await Profile.findOne({ username }, 'displayName pronouns customPronouns bio avatar followers following');
      res.json(profile || {});
    } else {
      // Own profile (auth required)
      authenticateToken(req, res, async () => {
        const user = req.user.username;
        const profile = await Profile.findOne({ username: user }, 'displayName pronouns customPronouns bio avatar followers following');
        res.json(profile || {});
      });
    }
  } catch (err) {
    res.status(500).json({ error: 'DB error' });
  }
});

// Update profile (auth required)
app.post('/api/profile', authenticateToken, async (req, res) => {
  const username = req.user.username;
  const { displayName, pronouns, customPronouns, bio, avatar } = req.body;
  try {
    let profile = await Profile.findOne({ username });
    if (!profile) {
      profile = new Profile({ username, displayName, pronouns, customPronouns, bio, avatar });
    } else {
      profile.displayName = displayName;
      profile.pronouns = pronouns;
      profile.customPronouns = customPronouns;
      profile.bio = bio;
      profile.avatar = avatar;
    }
    await profile.save();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'DB error', details: err.message });
  }
});

// Helper: authenticate JWT
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

// Register
app.post('/api/signup', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Missing fields' });
  try {
    const existing = await User.findOne({ username });
    if (existing) return res.status(409).json({ error: 'Username exists' });
    const hash = bcrypt.hashSync(password, 10);
    const user = new User({ username, password: hash });
    await user.save();
    const token = jwt.sign({ username }, SECRET, { expiresIn: '7d' });
    res.json({ token, username });
  } catch (err) {
    res.status(500).json({ error: 'DB error' });
  }
});

// Login
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const user = await User.findOne({ username });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    if (!bcrypt.compareSync(password, user.password)) return res.status(401).json({ error: 'Invalid credentials' });
    const token = jwt.sign({ username }, SECRET, { expiresIn: '7d' });
    res.json({ token, username });
  } catch (err) {
    res.status(500).json({ error: 'DB error' });
  }
});

// Post comment (no auth required, anonymous allowed)
app.post('/api/comments', async (req, res) => {
  const { videoId, text } = req.body;
  let username = req.body.username || 'Anonymous';
  if (!videoId || !text) return res.status(400).json({ error: 'Missing fields' });
  const date = new Date().toLocaleString();
  try {
    const comment = new Comment({ videoId, username, text, date });
    await comment.save();
    res.json(comment);
  } catch (err) {
    res.status(500).json({ error: 'DB error' });
  }
});

// Get comments for a video
app.get('/api/comments/:videoId', async (req, res) => {
  const videoId = req.params.videoId;
  try {
    const comments = await Comment.find({ videoId }).sort({ _id: -1 });
    res.json(comments);
  } catch (err) {
    res.status(500).json({ error: 'DB error' });
  }
});

server.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});
