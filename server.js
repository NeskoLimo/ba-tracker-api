// server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const pool = require('./db');

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/projects', require('./routes/projects'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/users', require('./routes/users'));

// Auto-run migrations on startup
async function runMigrations() {
  try {
    const fs = require('fs');
    const sql = fs.readFileSync('./schema.sql', 'utf8');
    await pool.query(sql);
    console.log('✅ Database schema ready');
  } catch (err) {
    console.error('⚠️ Migration warning:', err.message);
  }
}

// Start server
app.listen(PORT, async () => {
  console.log(`🚀 BA Tracker API running on port ${PORT}`);
  await runMigrations();
});
