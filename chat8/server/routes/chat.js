import express from 'express';
import Message from '../models/Message.js';
const router = express.Router();
import jwt from 'jsonwebtoken';

function authMiddleware(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: 'No token' });
  try {
    const token = auth.split(' ')[1];
    req.user = jwt.verify(token, 'secret');
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

// Get messages for a room
router.get('/messages/:room', authMiddleware, async (req, res) => {
  const { room } = req.params;
  const messages = await Message.find({ room }).populate('sender', 'username').sort({ createdAt: 1 }).limit(100);
  res.json(messages);
});

// Post a new message
router.post('/messages/:room', authMiddleware, async (req, res) => {
  const { room } = req.params;
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: 'No text' });
  const msg = await Message.create({ sender: req.user.id, room, text });
  res.json(msg);
});

export default router;
