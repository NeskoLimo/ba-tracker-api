// routes/users.js
const express = require('express');
const router = express.Router();
const pool = require('../db');
const { authenticateToken, requireRole } = require('../middleware/auth');

// GET /api/users (Admin only)
router.get('/', authenticateToken, requireRole('Admin'), async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, name, email, role, status, provider, avatar, created_at FROM users ORDER BY created_at DESC'
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/users/pending (Admin only)
router.get('/pending', authenticateToken, requireRole('Admin'), async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, name, email, role, reason, created_at FROM users WHERE status = 'pending' ORDER BY created_at ASC"
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/users/:id/approve (Admin only)
router.put('/:id/approve', authenticateToken, requireRole('Admin'), async (req, res) => {
  try {
    const { role } = req.body;
    const result = await pool.query(
      "UPDATE users SET status = 'active', role = COALESCE($1, role), updated_at = NOW() WHERE id = $2 RETURNING id, name, email, role, status",
      [role, req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'User not found' });
    res.json({ message: 'User approved successfully', user: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/users/:id/suspend (Admin only)
router.put('/:id/suspend', authenticateToken, requireRole('Admin'), async (req, res) => {
  try {
    const result = await pool.query(
      "UPDATE users SET status = 'suspended', updated_at = NOW() WHERE id = $1 RETURNING id, name, email, status",
      [req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'User not found' });
    res.json({ message: 'User suspended', user: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/users/:id/role (Admin only)
router.put('/:id/role', authenticateToken, requireRole('Admin'), async (req, res) => {
  try {
    const { role } = req.body;
    const result = await pool.query(
      'UPDATE users SET role = $1, updated_at = NOW() WHERE id = $2 RETURNING id, name, email, role',
      [role, req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'User not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/users/:id (Admin only)
router.delete('/:id', authenticateToken, requireRole('Admin'), async (req, res) => {
  try {
    if (req.params.id === req.user.id) return res.status(400).json({ error: 'Cannot delete your own account' });
    await pool.query('DELETE FROM users WHERE id = $1', [req.params.id]);
    res.json({ message: 'User deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
