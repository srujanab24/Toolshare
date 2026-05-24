// reviews.js
const express = require('express');
const router = express.Router();
const db = require('../database');
const { authenticate } = require('./auth');

router.post('/', authenticate, (req, res) => {
  if (req.user.role !== 'customer') return res.status(403).json({ error: 'Customers only' });
  const { tool_id, booking_id, rating, comment } = req.body;

  const booking = db.prepare('SELECT * FROM bookings WHERE id = ? AND customer_id = ? AND status = ?').get(booking_id, req.user.id, 'completed');
  if (!booking) return res.status(400).json({ error: 'Can only review completed bookings' });

  const existing = db.prepare('SELECT id FROM reviews WHERE booking_id = ?').get(booking_id);
  if (existing) return res.status(409).json({ error: 'Already reviewed' });

  const result = db.prepare(`
    INSERT INTO reviews (tool_id, booking_id, reviewer_id, rating, comment) VALUES (?,?,?,?,?)
  `).run(tool_id, booking_id, req.user.id, rating, comment);

  res.json({ id: result.lastInsertRowid });
});

router.get('/tool/:toolId', (req, res) => {
  const reviews = db.prepare(`
    SELECT r.*, u.name as reviewer_name FROM reviews r
    JOIN users u ON r.reviewer_id = u.id
    WHERE r.tool_id = ? ORDER BY r.created_at DESC
  `).all(req.params.toolId);
  res.json(reviews);
});

module.exports = router;
