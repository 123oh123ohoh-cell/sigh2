import express from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import mongoose from 'mongoose';
import cors from 'cors';
import authRoutes from './routes/auth.js';
import chatRoutes from './routes/chat.js';
import Message from './models/Message.js';
import User from './models/User.js';

const app = express();
const server = http.createServer(app);
const io = new SocketIOServer(server, { cors: { origin: '*' } });

app.use(cors());
app.use(express.json());

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/chat', chatRoutes);

// Socket.IO logic
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  socket.on('joinRoom', (room) => {
    socket.join(room);
  });
  socket.on('chatMessage', async (data) => {
    // data: { room, text, token }
    try {
      const { room, text, token } = data;
      if (!token) return;
      const payload = require('jsonwebtoken').verify(token, 'secret');
      const user = await User.findById(payload.id);
      if (!user) return;
      const msg = await Message.create({ sender: user._id, room, text });
      io.to(room).emit('chatMessage', { text, room, sender: user.username, createdAt: msg.createdAt });
    } catch (e) {
      // ignore
    }
  });
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// MongoDB connection
mongoose.connect('mongodb://localhost:27017/chat8', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
