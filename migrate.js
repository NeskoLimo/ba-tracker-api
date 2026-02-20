// migrate.js - Run once to create tables
require('dotenv').config();
const fs = require('fs');
const pool = require('./db');

async function migrate() {
  try {
    console.log('🔄 Running database migration...');
    const sql = fs.readFileSync('./schema.sql', 'utf8');
    await pool.query(sql);
    console.log('✅ Migration complete!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  }
}

migrate();
