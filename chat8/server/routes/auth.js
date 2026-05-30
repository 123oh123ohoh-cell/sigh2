import express from 'express';
const router = express.Router();
import User from '../models/User.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

// Register
router.post('/register', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Missing fields' });
  try {
    const existing = await User.findOne({ username });
    if (existing) return res.status(409).json({ error: 'User exists' });
    const hash = await bcrypt.hash(password, 10);
    const user = await User.create({ username, password: hash });
    res.json({ success: true, user: { username: user.username, id: user._id } });
  } catch (e) {
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Login
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Missing fields' });
  try {
    const user = await User.findOne({ username });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ error: 'Invalid credentials' });
    const token = jwt.sign({ id: user._id, username: user.username }, 'secret', { expiresIn: '1d' });
    res.json({ token, user: { username: user.username, id: user._id } });
  } catch (e) {
    res.status(500).json({ error: 'Login failed' });
  }
});

export default router;
