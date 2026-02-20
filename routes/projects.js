// routes/projects.js
const express = require('express');
const router = express.Router();
const pool = require('../db');
const { authenticateToken, requireRole } = require('../middleware/auth');

// GET /api/projects
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { status, priority, type, search } = req.query;
    let query = `
      SELECT p.*, 
        COALESCE(json_agg(DISTINCT s.role) FILTER (WHERE s.id IS NOT NULL), '[]') as sign_offs,
        COALESCE(json_agg(DISTINCT d.filename) FILTER (WHERE d.id IS NOT NULL), '[]') as documents,
        COUNT(DISTINCT m.id) as mention_count
      FROM projects p
      LEFT JOIN sign_offs s ON s.project_id = p.id
      LEFT JOIN documents d ON d.project_id = p.id
      LEFT JOIN mentions m ON m.project_id = p.id
      WHERE 1=1
    `;
    const params = [];
    let idx = 1;

    if (status) { query += ` AND p.status = $${idx++}`; params.push(status); }
    if (priority) { query += ` AND p.priority = $${idx++}`; params.push(priority); }
    if (type) { query += ` AND p.type = $${idx++}`; params.push(type); }
    if (search) { query += ` AND (p.name ILIKE $${idx} OR p.pm_name ILIKE $${idx++})`; params.push(`%${search}%`); }

    query += ' GROUP BY p.id ORDER BY p.created_at DESC';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Get projects error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/projects/:id
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT p.*,
        COALESCE(json_agg(DISTINCT jsonb_build_object('id', s.id, 'role', s.role, 'approved_by_name', s.approved_by_name, 'approved_at', s.approved_at)) FILTER (WHERE s.id IS NOT NULL), '[]') as sign_offs,
        COALESCE(json_agg(DISTINCT jsonb_build_object('id', d.id, 'filename', d.filename, 'uploaded_by_name', d.uploaded_by_name, 'created_at', d.created_at)) FILTER (WHERE d.id IS NOT NULL), '[]') as documents,
        COALESCE(json_agg(DISTINCT jsonb_build_object('id', m.id, 'user_name', m.user_name, 'message', m.message, 'created_at', m.created_at)) FILTER (WHERE m.id IS NOT NULL), '[]') as mentions
      FROM projects p
      LEFT JOIN sign_offs s ON s.project_id = p.id
      LEFT JOIN documents d ON d.project_id = p.id
      LEFT JOIN mentions m ON m.project_id = p.id
      WHERE p.id = $1
      GROUP BY p.id
    `, [req.params.id]);

    if (!result.rows[0]) return res.status(404).json({ error: 'Project not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/projects
router.post('/', authenticateToken, requireRole('Admin', 'PM'), async (req, res) => {
  try {
    const { name, type, pm_name, status, priority, budget, spent, progress, start_date, end_date } = req.body;
    if (!name) return res.status(400).json({ error: 'Project name is required' });

    const result = await pool.query(`
      INSERT INTO projects (name, type, pm_name, status, priority, budget, spent, progress, start_date, end_date, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `, [name, type || 'BA', pm_name || req.user.name, status || 'Planning', priority || 'Medium',
        budget || 0, spent || 0, progress || 0, start_date || null, end_date || null, req.user.id]);

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create project error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/projects/:id
router.put('/:id', authenticateToken, requireRole('Admin', 'PM'), async (req, res) => {
  try {
    const { name, type, pm_name, status, priority, budget, spent, progress, start_date, end_date } = req.body;

    const result = await pool.query(`
      UPDATE projects SET
        name = COALESCE($1, name),
        type = COALESCE($2, type),
        pm_name = COALESCE($3, pm_name),
        status = COALESCE($4, status),
        priority = COALESCE($5, priority),
        budget = COALESCE($6, budget),
        spent = COALESCE($7, spent),
        progress = COALESCE($8, progress),
        start_date = COALESCE($9, start_date),
        end_date = COALESCE($10, end_date),
        updated_at = NOW()
      WHERE id = $11
      RETURNING *
    `, [name, type, pm_name, status, priority, budget, spent, progress, start_date, end_date, req.params.id]);

    if (!result.rows[0]) return res.status(404).json({ error: 'Project not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/projects/:id
router.delete('/:id', authenticateToken, requireRole('Admin'), async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM projects WHERE id = $1 RETURNING id', [req.params.id]);
    if (!result.rows[0]) return res.status(404).json({ error: 'Project not found' });
    res.json({ message: 'Project deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/projects/:id/mentions
router.post('/:id/mentions', authenticateToken, async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: 'Message is required' });

    const result = await pool.query(
      'INSERT INTO mentions (project_id, user_id, user_name, message) VALUES ($1, $2, $3, $4) RETURNING *',
      [req.params.id, req.user.id, req.user.name, message]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/projects/:id/mentions
router.get('/:id/mentions', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM mentions WHERE project_id = $1 ORDER BY created_at DESC',
      [req.params.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
