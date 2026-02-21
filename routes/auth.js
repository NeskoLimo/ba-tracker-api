const express = require('express');
const router = express.Router(); // Fixes the ReferenceError: router is not defined
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../middleware/auth');
const pool = require('../db'); // Adjust this path to where your PG pool is defined

// 1. LOGIN ROUTE
router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    try {
        // Querying your Postgres database
        const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        const user = result.rows[0];

        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Note: For a production build, use bcrypt.compare(password, user.password)
        if (password !== user.password) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Generate the token using the secret from your middleware file
        const token = jwt.sign(
            { id: user.id, email: user.email, role: user.role },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({
            token,
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role
            }
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database connection error' });
    }
});

// 2. REGISTER ROUTE (Initial Access Request)
router.post('/register', async (req, res) => {
    const { email, password, name } = req.body;
    try {
        const newUser = await pool.query(
            'INSERT INTO users (email, password, name, role) VALUES ($1, $2, $3, $4) RETURNING *',
            [email, password, name, 'Viewer'] // Default role
        );
        res.status(201).json(newUser.rows[0]);
    } catch (err) {
        res.status(500).json({ error: 'Could not register user' });
    }
});

// Line 29: Export the router so server.js can use it
module.exports = router;
