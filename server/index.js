require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const db = require('./database');
const authRoutes = require('./routes/auth');
const toolRoutes = require('./routes/tools');
const bookingRoutes = require('./routes/bookings');
const reviewRoutes = require('./routes/reviews');
const chatRoutes = require('./routes/chat');
const dashboardRoutes = require('./routes/dashboard');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/tools', toolRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/dashboard', dashboardRoutes);

// Serve frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Socket.IO for real-time chat
const onlineUsers = new Map();

io.on('connection', (socket) => {
  socket.on('user_connected', (userId) => {
    onlineUsers.set(userId, socket.id);
    io.emit('online_users', Array.from(onlineUsers.keys()));
  });

  socket.on('send_message', (data) => {
    const { senderId, receiverId, message, toolId } = data;
    const stmt = db.prepare(`
      INSERT INTO messages (sender_id, receiver_id, message, tool_id, created_at)
      VALUES (?, ?, ?, ?, datetime('now'))
    `);
    const result = stmt.run(senderId, receiverId, message, toolId || null);
    const newMsg = {
      id: result.lastInsertRowid,
      sender_id: senderId,
      receiver_id: receiverId,
      message,
      tool_id: toolId,
      created_at: new Date().toISOString()
    };
    const receiverSocket = onlineUsers.get(String(receiverId));
    if (receiverSocket) {
      io.to(receiverSocket).emit('receive_message', newMsg);
    }
    socket.emit('message_sent', newMsg);
  });

  socket.on('disconnect', () => {
    for (const [userId, sid] of onlineUsers.entries()) {
      if (sid === socket.id) {
        onlineUsers.delete(userId);
        break;
      }
    }
    io.emit('online_users', Array.from(onlineUsers.keys()));
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`\n🔧 ToolShare server running at http://localhost:${PORT}\n`);
});
