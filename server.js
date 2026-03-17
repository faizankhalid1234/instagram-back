import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server } from 'socket.io';
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import postRoutes from './routes/posts.js';
import storyRoutes from './routes/stories.js';

dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/stories', storyRoutes);

// Socket.io for real-time features
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('like', (data) => {
    io.emit('likeUpdate', data);
  });

  socket.on('comment', (data) => {
    io.emit('commentUpdate', data);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 5000;

// MongoDB Connection - connect before starting server
async function startServer() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ MongoDB Connected Successfully!');
    console.log('✅ Database:', mongoose.connection.db.databaseName);
  } catch (err) {
    console.error('❌ MongoDB Connection Error:', err.message);
    console.error('\n📋 Troubleshooting tips:');
    console.error('   1. Check username/password in MongoDB Atlas → Database Access');
    console.error('   2. Reset user password if needed, then update .env MONGO_URI');
    console.error('   3. Whitelist your IP: Atlas → Network Access → Add IP (0.0.0.0/0 for dev)');
    console.error('   4. If password has @,#,: etc, URL-encode them (e.g. @ → %40)\n');
    process.exit(1);
  }

  httpServer.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();

export { io };
