// routes/auth.js — Register & Login routes
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const pool = require('../db/connection');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'govbill_fallback_secret';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

// POST /api/auth/register
router.post('/register', async (req, res) => {
  const { full_name, email, password } = req.body;

  if (!full_name || !email || !password) {
    return res.status(400).json({ error: 'Full name, email, and password are required.' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters.' });
  }

  try {
    // Check if email already exists
    const [existing] = await pool.execute('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length > 0) {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }

    const id = uuidv4();
    const password_hash = await bcrypt.hash(password, 12);

    await pool.execute(
      'INSERT INTO users (id, full_name, email, password_hash) VALUES (?, ?, ?, ?)',
      [id, full_name, email.toLowerCase().trim(), password_hash]
    );

    const token = jwt.sign({ id, email: email.toLowerCase().trim(), name: full_name }, JWT_SECRET, {
      expiresIn: JWT_EXPIRES_IN,
    });

    return res.status(201).json({
      message: 'Registration successful!',
      token,
      user: { id, name: full_name, email: email.toLowerCase().trim() },
    });
  } catch (err) {
    console.error('[Auth/Register] Error:', err);
    return res.status(500).json({ error: 'Server error during registration.' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  try {
    const [rows] = await pool.execute('SELECT * FROM users WHERE email = ?', [email.toLowerCase().trim()]);
    if (rows.length === 0) {
      return res.status(401).json({ error: 'No account found with this email.' });
    }

    const user = rows[0];
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Incorrect password. Please try again.' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, name: user.full_name },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    return res.json({
      message: 'Login successful!',
      token,
      user: { id: user.id, name: user.full_name, email: user.email },
    });
  } catch (err) {
    console.error('[Auth/Login] Error:', err);
    return res.status(500).json({ error: 'Server error during login.' });
  }
});

// GET /api/auth/me — Get current user info from token
router.get('/me', require('../middleware/auth'), async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT id, full_name, email, created_at FROM users WHERE id = ?', [req.user.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'User not found.' });
    const u = rows[0];
    return res.json({ id: u.id, name: u.full_name, email: u.email, createdAt: u.created_at });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch user.' });
  }
});

module.exports = router;
