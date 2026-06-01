// routes/companies.js — CRUD for seller company profiles
const express = require('express');
const { v4: uuidv4 } = require('uuid');
const pool = require('../db/connection');
const auth = require('../middleware/auth');

const router = express.Router();
router.use(auth); // All company routes require login

// GET /api/companies — List all companies for logged-in user
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT * FROM companies WHERE user_id = ? ORDER BY is_default DESC, created_at ASC',
      [req.user.id]
    );
    res.json(rows.map(formatCompany));
  } catch (err) {
    console.error('[Companies/GET]', err);
    res.status(500).json({ error: 'Failed to fetch companies.' });
  }
});

// POST /api/companies — Create a new company
router.post('/', async (req, res) => {
  const { name, address, gstin, pan, phone, email, is_default } = req.body;
  if (!name) return res.status(400).json({ error: 'Company name is required.' });

  try {
    const id = uuidv4();
    const makeDefault = is_default ? 1 : 0;

    // If this is the first company, auto-set as default
    const [existing] = await pool.execute('SELECT COUNT(*) as cnt FROM companies WHERE user_id = ?', [req.user.id]);
    const isFirst = existing[0].cnt === 0;
    const finalDefault = isFirst ? 1 : makeDefault;

    if (finalDefault) {
      // Un-default all existing companies
      await pool.execute('UPDATE companies SET is_default = 0 WHERE user_id = ?', [req.user.id]);
    }

    await pool.execute(
      `INSERT INTO companies (id, user_id, name, address, gstin, pan, phone, email, is_default)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, req.user.id, name, address || '', gstin || null, pan || null, phone || null, email || null, finalDefault]
    );

    const [newRow] = await pool.execute('SELECT * FROM companies WHERE id = ?', [id]);
    res.status(201).json(formatCompany(newRow[0]));
  } catch (err) {
    console.error('[Companies/POST]', err);
    res.status(500).json({ error: 'Failed to create company.' });
  }
});

// PUT /api/companies/:id — Update company
router.put('/:id', async (req, res) => {
  const { name, address, gstin, pan, phone, email } = req.body;
  try {
    const [rows] = await pool.execute('SELECT id FROM companies WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Company not found.' });

    await pool.execute(
      `UPDATE companies SET name = ?, address = ?, gstin = ?, pan = ?, phone = ?, email = ?, updated_at = NOW()
       WHERE id = ? AND user_id = ?`,
      [name, address || '', gstin || null, pan || null, phone || null, email || null, req.params.id, req.user.id]
    );

    const [updated] = await pool.execute('SELECT * FROM companies WHERE id = ?', [req.params.id]);
    res.json(formatCompany(updated[0]));
  } catch (err) {
    console.error('[Companies/PUT]', err);
    res.status(500).json({ error: 'Failed to update company.' });
  }
});

// PATCH /api/companies/:id/set-default — Set a company as default
router.patch('/:id/set-default', async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT id FROM companies WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Company not found.' });

    await pool.execute('UPDATE companies SET is_default = 0 WHERE user_id = ?', [req.user.id]);
    await pool.execute('UPDATE companies SET is_default = 1 WHERE id = ?', [req.params.id]);

    res.json({ message: 'Default company updated.' });
  } catch (err) {
    console.error('[Companies/SET-DEFAULT]', err);
    res.status(500).json({ error: 'Failed to update default company.' });
  }
});

// DELETE /api/companies/:id — Delete a company
router.delete('/:id', async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM companies WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Company not found.' });
    if (rows[0].is_default) return res.status(400).json({ error: 'Cannot delete the default company. Set another as default first.' });

    await pool.execute('DELETE FROM companies WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
    res.json({ message: 'Company deleted.' });
  } catch (err) {
    console.error('[Companies/DELETE]', err);
    res.status(500).json({ error: 'Failed to delete company.' });
  }
});

// Helper: format DB row → frontend shape
function formatCompany(row) {
  return {
    id: row.id,
    name: row.name,
    address: row.address,
    gstin: row.gstin || '',
    pan: row.pan || '',
    phone: row.phone || '',
    email: row.email || '',
    isDefault: row.is_default === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

module.exports = router;
