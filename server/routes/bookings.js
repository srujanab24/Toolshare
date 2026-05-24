const express = require('express');
const router = express.Router();
const db = require('../database');
const { authenticate } = require('./auth');

// Create booking
router.post('/', authenticate, (req, res) => {
  if (req.user.role !== 'customer') return res.status(403).json({ error: 'Customers only' });
  const { tool_id, start_date, end_date, notes } = req.body;

  const tool = db.prepare('SELECT * FROM tools WHERE id = ?').get(tool_id);
  if (!tool) return res.status(404).json({ error: 'Tool not found' });
  if (!tool.is_available) return res.status(400).json({ error: 'Tool not available' });

  // Check for conflicts
  const conflict = db.prepare(`
    SELECT id FROM bookings WHERE tool_id = ? AND status IN ('confirmed','active')
    AND NOT (end_date < ? OR start_date > ?)
  `).get(tool_id, start_date, end_date);
  if (conflict) return res.status(409).json({ error: 'Tool already booked for these dates' });

  const start = new Date(start_date);
  const end = new Date(end_date);
  const days = Math.max(1, Math.ceil((end - start) / (1000 * 60 * 60 * 24)));
  const total = days * tool.price_per_day;

  const result = db.prepare(`
    INSERT INTO bookings (tool_id, customer_id, owner_id, start_date, end_date, total_days, total_amount, notes)
    VALUES (?,?,?,?,?,?,?,?)
  `).run(tool_id, req.user.id, tool.owner_id, start_date, end_date, days, total, notes || '');

  res.json({ id: result.lastInsertRowid, total_days: days, total_amount: total });
});

// Get bookings (customer gets own, owner gets their tools' bookings)
router.get('/', authenticate, (req, res) => {
  let bookings;
  if (req.user.role === 'customer') {
    bookings = db.prepare(`
      SELECT b.*, t.title as tool_title, t.image as tool_image, t.price_per_day,
        u.name as owner_name, u.phone as owner_phone
      FROM bookings b
      JOIN tools t ON b.tool_id = t.id
      JOIN users u ON b.owner_id = u.id
      WHERE b.customer_id = ? ORDER BY b.created_at DESC
    `).all(req.user.id);
  } else {
    bookings = db.prepare(`
      SELECT b.*, t.title as tool_title, t.image as tool_image,
        u.name as customer_name, u.phone as customer_phone
      FROM bookings b
      JOIN tools t ON b.tool_id = t.id
      JOIN users u ON b.customer_id = u.id
      WHERE b.owner_id = ? ORDER BY b.created_at DESC
    `).all(req.user.id);
  }
  res.json(bookings);
});

// Update booking status (owner confirms/cancels, customer cancels)
router.patch('/:id/status', authenticate, (req, res) => {
  const { status } = req.body;
  const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(req.params.id);
  if (!booking) return res.status(404).json({ error: 'Not found' });

  const allowed = req.user.role === 'owner'
    ? ['confirmed', 'completed', 'cancelled']
    : ['cancelled'];

  if (!allowed.includes(status)) return res.status(403).json({ error: 'Not allowed' });
  if (req.user.role === 'owner' && booking.owner_id !== req.user.id) return res.status(403).json({ error: 'Forbidden' });
  if (req.user.role === 'customer' && booking.customer_id !== req.user.id) return res.status(403).json({ error: 'Forbidden' });

  db.prepare('UPDATE bookings SET status = ? WHERE id = ?').run(status, req.params.id);
  res.json({ success: true });
});

module.exports = router;
