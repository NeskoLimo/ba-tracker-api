// routes/reports.js
const express = require('express');
const router = express.Router();
const pool = require('../db');
const { authenticateToken } = require('../middleware/auth');

// GET /api/reports/summary
router.get('/summary', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        COUNT(*) as total_projects,
        COUNT(*) FILTER (WHERE status = 'Active') as active,
        COUNT(*) FILTER (WHERE status = 'Completed') as completed,
        COUNT(*) FILTER (WHERE status = 'At Risk') as at_risk,
        COUNT(*) FILTER (WHERE status = 'On Hold') as on_hold,
        COUNT(*) FILTER (WHERE status = 'Planning') as planning,
        COALESCE(SUM(budget), 0) as total_budget,
        COALESCE(SUM(spent), 0) as total_spent,
        COALESCE(AVG(progress), 0) as avg_progress
      FROM projects
    `);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/reports/pm-performance
router.get('/pm-performance', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        pm_name,
        COUNT(*) as total_projects,
        COUNT(*) FILTER (WHERE status = 'Completed') as completed,
        ROUND(AVG(progress)) as avg_progress,
        COALESCE(SUM(budget), 0) as total_budget,
        COALESCE(SUM(spent), 0) as total_spent,
        ROUND(
          100.0 * COUNT(*) FILTER (WHERE end_date >= NOW() OR status = 'Completed')
          / NULLIF(COUNT(*), 0)
        ) as on_time_rate,
        ROUND(
          100.0 * COUNT(*) FILTER (WHERE spent <= budget)
          / NULLIF(COUNT(*), 0)
        ) as budget_adherence
      FROM projects
      WHERE pm_name IS NOT NULL
      GROUP BY pm_name
      ORDER BY avg_progress DESC
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/reports/budget
router.get('/budget', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT name, budget, spent, (budget - spent) as variance,
        ROUND(100.0 * spent / NULLIF(budget, 0)) as spent_pct
      FROM projects
      WHERE budget > 0
      ORDER BY budget DESC
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/reports/status-breakdown
router.get('/status-breakdown', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT status, COUNT(*) as count,
        ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER()) as pct
      FROM projects
      GROUP BY status
      ORDER BY count DESC
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/reports/timeline
router.get('/timeline', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, name, pm_name, status, progress, start_date, end_date
      FROM projects
      WHERE start_date IS NOT NULL AND end_date IS NOT NULL
      ORDER BY start_date ASC
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
