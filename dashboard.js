const express = require('express');
const router = express.Router();
const db = require('../database');
const { authenticate } = require('./auth');

// Owner dashboard stats
router.get('/owner', authenticate, (req, res) => {
  if (req.user.role !== 'owner') return res.status(403).json({ error: 'Owners only' });
  const id = req.user.id;

  const totalTools = db.prepare('SELECT COUNT(*) as cnt FROM tools WHERE owner_id = ?').get(id).cnt;
  const activeTools = db.prepare('SELECT COUNT(*) as cnt FROM tools WHERE owner_id = ? AND is_available = 1').get(id).cnt;
  const totalBookings = db.prepare('SELECT COUNT(*) as cnt FROM bookings WHERE owner_id = ?').get(id).cnt;
  const pendingBookings = db.prepare("SELECT COUNT(*) as cnt FROM bookings WHERE owner_id = ? AND status = 'pending'").get(id).cnt;
  const totalRevenue = db.prepare("SELECT COALESCE(SUM(total_amount),0) as rev FROM bookings WHERE owner_id = ? AND status IN ('confirmed','completed','active')").get(id).rev;
  const avgRating = db.prepare(`
    SELECT COALESCE(AVG(r.rating),0) as avg FROM reviews r
    JOIN tools t ON r.tool_id = t.id WHERE t.owner_id = ?
  `).get(id).avg;

  const recentBookings = db.prepare(`
    SELECT b.*, t.title as tool_title, u.name as customer_name
    FROM bookings b JOIN tools t ON b.tool_id = t.id JOIN users u ON b.customer_id = u.id
    WHERE b.owner_id = ? ORDER BY b.created_at DESC LIMIT 5
  `).all(id);

  const topTools = db.prepare(`
    SELECT t.title, t.price_per_day, COUNT(b.id) as bookings,
      COALESCE(SUM(b.total_amount),0) as revenue
    FROM tools t LEFT JOIN bookings b ON b.tool_id = t.id AND b.status != 'cancelled'
    WHERE t.owner_id = ? GROUP BY t.id ORDER BY revenue DESC LIMIT 5
  `).all(id);

  const monthlyRevenue = db.prepare(`
    SELECT strftime('%Y-%m', created_at) as month, COALESCE(SUM(total_amount),0) as revenue
    FROM bookings WHERE owner_id = ? AND status IN ('confirmed','completed','active')
    GROUP BY month ORDER BY month DESC LIMIT 6
  `).all(id);

  res.json({ totalTools, activeTools, totalBookings, pendingBookings, totalRevenue, avgRating, recentBookings, topTools, monthlyRevenue });
});

// Customer dashboard stats
router.get('/customer', authenticate, (req, res) => {
  if (req.user.role !== 'customer') return res.status(403).json({ error: 'Customers only' });
  const id = req.user.id;

  const totalRentals = db.prepare('SELECT COUNT(*) as cnt FROM bookings WHERE customer_id = ?').get(id).cnt;
  const activeRentals = db.prepare("SELECT COUNT(*) as cnt FROM bookings WHERE customer_id = ? AND status IN ('confirmed','active')").get(id).cnt;
  const totalSpent = db.prepare("SELECT COALESCE(SUM(total_amount),0) as amt FROM bookings WHERE customer_id = ? AND status != 'cancelled'").get(id).amt;
  const pendingReviews = db.prepare(`
    SELECT COUNT(*) as cnt FROM bookings b
    WHERE b.customer_id = ? AND b.status = 'completed'
    AND NOT EXISTS (SELECT 1 FROM reviews r WHERE r.booking_id = b.id)
  `).get(id).cnt;

  const recentRentals = db.prepare(`
    SELECT b.*, t.title as tool_title, t.image as tool_image, u.name as owner_name
    FROM bookings b JOIN tools t ON b.tool_id = t.id JOIN users u ON b.owner_id = u.id
    WHERE b.customer_id = ? ORDER BY b.created_at DESC LIMIT 5
  `).all(id);

  res.json({ totalRentals, activeRentals, totalSpent, pendingReviews, recentRentals });
});

module.exports = router;
