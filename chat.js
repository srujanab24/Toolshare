const express = require('express');
const router = express.Router();
const db = require('../database');
const { authenticate } = require('./auth');

// Get conversation list
router.get('/conversations', authenticate, (req, res) => {
  const conversations = db.prepare(`
    SELECT
      CASE WHEN m.sender_id = ? THEN m.receiver_id ELSE m.sender_id END as other_user_id,
      u.name as other_user_name, u.role as other_user_role,
      m.message as last_message, m.created_at as last_time,
      SUM(CASE WHEN m.receiver_id = ? AND m.is_read = 0 THEN 1 ELSE 0 END) as unread_count
    FROM messages m
    JOIN users u ON u.id = (CASE WHEN m.sender_id = ? THEN m.receiver_id ELSE m.sender_id END)
    WHERE m.sender_id = ? OR m.receiver_id = ?
    GROUP BY other_user_id
    ORDER BY last_time DESC
  `).all(req.user.id, req.user.id, req.user.id, req.user.id, req.user.id);
  res.json(conversations);
});

// Get messages with a user
router.get('/:userId', authenticate, (req, res) => {
  const msgs = db.prepare(`
    SELECT m.*, u.name as sender_name FROM messages m
    JOIN users u ON m.sender_id = u.id
    WHERE (m.sender_id = ? AND m.receiver_id = ?)
       OR (m.sender_id = ? AND m.receiver_id = ?)
    ORDER BY m.created_at ASC
  `).all(req.user.id, req.params.userId, req.params.userId, req.user.id);

  // Mark as read
  db.prepare('UPDATE messages SET is_read = 1 WHERE receiver_id = ? AND sender_id = ?')
    .run(req.user.id, req.params.userId);

  res.json(msgs);
});

module.exports = router;
