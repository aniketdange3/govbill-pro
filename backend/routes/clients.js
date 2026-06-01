// routes/clients.js — CRUD for government department clients
const express = require('express');
const { v4: uuidv4 } = require('uuid');
const pool = require('../db/connection');
const auth = require('../middleware/auth');

const router = express.Router();
router.use(auth);

// GET /api/clients
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT * FROM clients WHERE user_id = ? ORDER BY created_at DESC',
      [req.user.id]
    );
    res.json(rows.map(formatClient));
  } catch (err) {
    console.error('[Clients/GET]', err);
    res.status(500).json({ error: 'Failed to fetch clients.' });
  }
});

// POST /api/clients
router.post('/', async (req, res) => {
  const { name, address, gstin, contact_person, email, phone } = req.body;
  if (!name) return res.status(400).json({ error: 'Client name is required.' });

  try {
    const id = uuidv4();
    await pool.execute(
      `INSERT INTO clients (id, user_id, name, address, gstin, contact_person, email, phone)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, req.user.id, name, address || null, gstin || null, contact_person || null, email || null, phone || null]
    );
    const [newRow] = await pool.execute('SELECT * FROM clients WHERE id = ?', [id]);
    res.status(201).json(formatClient(newRow[0]));
  } catch (err) {
    console.error('[Clients/POST]', err);
    res.status(500).json({ error: 'Failed to create client.' });
  }
});

// PUT /api/clients/:id
router.put('/:id', async (req, res) => {
  const { name, address, gstin, contact_person, email, phone } = req.body;
  try {
    const [rows] = await pool.execute('SELECT id FROM clients WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Client not found.' });

    await pool.execute(
      `UPDATE clients SET name = ?, address = ?, gstin = ?, contact_person = ?, email = ?, phone = ?, updated_at = NOW()
       WHERE id = ? AND user_id = ?`,
      [name, address || null, gstin || null, contact_person || null, email || null, phone || null, req.params.id, req.user.id]
    );

    const [updated] = await pool.execute('SELECT * FROM clients WHERE id = ?', [req.params.id]);
    res.json(formatClient(updated[0]));
  } catch (err) {
    console.error('[Clients/PUT]', err);
    res.status(500).json({ error: 'Failed to update client.' });
  }
});

// DELETE /api/clients/:id
router.delete('/:id', async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT id FROM clients WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Client not found.' });

    await pool.execute('DELETE FROM clients WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
    res.json({ message: 'Client deleted.' });
  } catch (err) {
    console.error('[Clients/DELETE]', err);
    res.status(500).json({ error: 'Failed to delete client.' });
  }
});

function formatClient(row) {
  return {
    id: row.id,
    name: row.name,
    address: row.address || '',
    gstin: row.gstin || '',
    contactPerson: row.contact_person || '',
    email: row.email || '',
    phone: row.phone || '',
    createdAt: row.created_at,
  };
}

module.exports = router;
