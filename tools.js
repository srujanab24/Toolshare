const express = require('express');
const router = express.Router();
const db = require('../database');
const { authenticate } = require('./auth');

// GET all tools with search/filter
router.get('/', (req, res) => {
  const { search, category, min_price, max_price, location, available } = req.query;
  let query = `
    SELECT t.*, u.name as owner_name, u.phone as owner_phone,
      COALESCE(AVG(r.rating), 0) as avg_rating,
      COUNT(r.id) as review_count
    FROM tools t
    JOIN users u ON t.owner_id = u.id
    LEFT JOIN reviews r ON r.tool_id = t.id
    WHERE 1=1
  `;
  const params = [];

  if (search) {
    query += ` AND (t.title LIKE ? OR t.description LIKE ? OR t.category LIKE ?)`;
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }
  if (category && category !== 'All') {
    query += ` AND t.category = ?`;
    params.push(category);
  }
  if (min_price) { query += ` AND t.price_per_day >= ?`; params.push(min_price); }
  if (max_price) { query += ` AND t.price_per_day <= ?`; params.push(max_price); }
  if (location) { query += ` AND t.location LIKE ?`; params.push(`%${location}%`); }
  if (available === 'true') { query += ` AND t.is_available = 1`; }

  query += ` GROUP BY t.id ORDER BY t.created_at DESC`;
  const tools = db.prepare(query).all(...params);
  res.json(tools);
});

// GET single tool
router.get('/:id', (req, res) => {
  const tool = db.prepare(`
    SELECT t.*, u.name as owner_name, u.phone as owner_phone, u.address as owner_address,
      COALESCE(AVG(r.rating), 0) as avg_rating, COUNT(r.id) as review_count
    FROM tools t
    JOIN users u ON t.owner_id = u.id
    LEFT JOIN reviews r ON r.tool_id = t.id
    WHERE t.id = ?
    GROUP BY t.id
  `).get(req.params.id);
  if (!tool) return res.status(404).json({ error: 'Tool not found' });

  const reviews = db.prepare(`
    SELECT r.*, u.name as reviewer_name FROM reviews r
    JOIN users u ON r.reviewer_id = u.id
    WHERE r.tool_id = ? ORDER BY r.created_at DESC
  `).all(req.params.id);

  const bookedDates = db.prepare(`
    SELECT start_date, end_date FROM bookings
    WHERE tool_id = ? AND status IN ('confirmed','active')
  `).all(req.params.id);

  res.json({ ...tool, reviews, bookedDates });
});

// GET categories
router.get('/meta/categories', (req, res) => {
  const cats = db.prepare('SELECT DISTINCT category FROM tools ORDER BY category').all();
  res.json(['All', ...cats.map(c => c.category)]);
});

// CREATE tool (owner only)
router.post('/', authenticate, (req, res) => {
  if (req.user.role !== 'owner') return res.status(403).json({ error: 'Owners only' });
  const { title, description, category, price_per_day, deposit, location, image, condition } = req.body;
  if (!title || !category || !price_per_day) return res.status(400).json({ error: 'Missing required fields' });

  const result = db.prepare(`
    INSERT INTO tools (owner_id, title, description, category, price_per_day, deposit, location, image, condition)
    VALUES (?,?,?,?,?,?,?,?,?)
  `).run(req.user.id, title, description, category, price_per_day, deposit || 0, location, image || '', condition || 'Good');

  res.json({ id: result.lastInsertRowid, success: true });
});

// UPDATE tool (owner only)
router.put('/:id', authenticate, (req, res) => {
  const tool = db.prepare('SELECT * FROM tools WHERE id = ?').get(req.params.id);
  if (!tool) return res.status(404).json({ error: 'Not found' });
  if (tool.owner_id !== req.user.id) return res.status(403).json({ error: 'Forbidden' });

  const { title, description, category, price_per_day, deposit, location, image, condition, is_available } = req.body;
  db.prepare(`
    UPDATE tools SET title=?, description=?, category=?, price_per_day=?, deposit=?,
    location=?, image=?, condition=?, is_available=? WHERE id=?
  `).run(title, description, category, price_per_day, deposit, location, image, condition, is_available, req.params.id);

  res.json({ success: true });
});

// DELETE tool
router.delete('/:id', authenticate, (req, res) => {
  const tool = db.prepare('SELECT * FROM tools WHERE id = ?').get(req.params.id);
  if (!tool) return res.status(404).json({ error: 'Not found' });
  if (tool.owner_id !== req.user.id) return res.status(403).json({ error: 'Forbidden' });
  db.prepare('DELETE FROM tools WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// Block a date (owner)
router.post('/:id/block', authenticate, (req, res) => {
  if (req.user.role !== 'owner') return res.status(403).json({ error: 'Owners only' });
  const { date, reason } = req.body;
  db.prepare('INSERT INTO availability_blocks (tool_id, blocked_date, reason) VALUES (?,?,?)').run(req.params.id, date, reason || '');
  res.json({ success: true });
});

module.exports = router;
