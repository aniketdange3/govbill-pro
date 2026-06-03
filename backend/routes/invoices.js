// routes/invoices.js — Full CRUD for invoices + line items
const express = require('express');
const { v4: uuidv4 } = require('uuid');
const pool = require('../db/connection');
const auth = require('../middleware/auth');

const router = express.Router();
router.use(auth);

// GET /api/invoices — List all invoices (with basic info, ordered by date desc)
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT i.*, c.name AS client_name, co.name AS company_name
       FROM invoices i
       LEFT JOIN clients c ON i.client_id = c.id
       LEFT JOIN companies co ON i.company_id = co.id
       WHERE i.user_id = ?
       ORDER BY i.created_at DESC`,
      [req.user.id]
    );
    res.json(rows.map(formatInvoiceSummary));
  } catch (err) {
    console.error('[Invoices/GET]', err);
    res.status(500).json({ error: 'Failed to fetch invoices.' });
  }
});

// GET /api/invoices/:id — Get single invoice with all items
router.get('/:id', async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT i.*, c.name AS client_name, co.name AS company_name,
              co.address AS company_address, co.gstin AS company_gstin,
              co.pan AS company_pan, co.phone AS company_phone, co.email AS company_email,
              u.full_name AS creator_name, u.email AS creator_email
       FROM invoices i
       LEFT JOIN clients c ON i.client_id = c.id
       LEFT JOIN companies co ON i.company_id = co.id
       LEFT JOIN users u ON i.user_id = u.id
       WHERE i.id = ? AND i.user_id = ?`,
      [req.params.id, req.user.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Invoice not found.' });

    const invoice = rows[0];
    const [items] = await pool.execute(
      'SELECT * FROM invoice_items WHERE invoice_id = ? ORDER BY sort_order ASC',
      [req.params.id]
    );

    res.json(formatInvoiceFull(invoice, items));
  } catch (err) {
    console.error('[Invoices/GET/:id]', err);
    res.status(500).json({ error: 'Failed to fetch invoice.' });
  }
});

// POST /api/invoices — Create a new invoice with items
router.post('/', async (req, res) => {
  const {
    invoice_no, invoice_date, company_id, client_id,
    bill_to, ship_to, subject, hide_zero_tax,
    items, total_taxable_value, total_tax_amount, total_amount, amount_in_words,
    status
  } = req.body;

  if (!invoice_no || !invoice_date) {
    return res.status(400).json({ error: 'Invoice number and date are required.' });
  }

  const conn = await pool.getConnection();
  try {
    if (company_id) {
      const [comp] = await conn.execute('SELECT id FROM companies WHERE id = ? AND user_id = ?', [company_id, req.user.id]);
      if (comp.length === 0) {
        return res.status(400).json({ error: 'The selected seller company profile does not exist.' });
      }
    }
    if (client_id) {
      const [cli] = await conn.execute('SELECT id FROM clients WHERE id = ? AND user_id = ?', [client_id, req.user.id]);
      if (cli.length === 0) {
        return res.status(400).json({ error: 'The selected client/department does not exist.' });
      }
    }

    await conn.beginTransaction();

    const id = uuidv4();
    await conn.execute(
      `INSERT INTO invoices (
        id, user_id, company_id, client_id, invoice_no, invoice_date,
        subject, bill_to_name, bill_to_address, bill_to_gstin, bill_to_place_of_supply,
        ship_to_name, ship_to_address,
        total_taxable_value, total_tax_amount, total_amount, amount_in_words,
        hide_zero_tax, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id, req.user.id,
        company_id || null,
        client_id || null,
        invoice_no,
        invoice_date,
        subject || null,
        bill_to?.name || '',
        bill_to?.address || '',
        bill_to?.gstin || null,
        bill_to?.placeOfSupply || 'Maharashtra',
        ship_to?.name || bill_to?.name || '',
        ship_to?.address || bill_to?.address || '',
        total_taxable_value || 0,
        total_tax_amount || 0,
        total_amount || 0,
        amount_in_words || '',
        hide_zero_tax !== false ? 1 : 0,
        status || 'sent',
      ]
    );

    // Insert all items
    if (items && items.length > 0) {
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const itemId = item.id && item.id.length > 8 ? item.id : uuidv4();
        await conn.execute(
          `INSERT INTO invoice_items (id, invoice_id, sort_order, hsn, description, qty, unit, rate, tax_rate, tax_amount, amount)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            itemId, id, i,
            item.hsn || '-',
            item.description || '',
            item.qty || 0,
            item.unit || 'PCS',
            item.rate || 0,
            item.taxRate || 0,
            item.taxAmount || 0,
            item.amount || 0,
          ]
        );
      }
    }

    await conn.commit();

    // Fetch the newly created invoice with full details
    const [newInv] = await pool.execute(
      `SELECT i.*, co.name AS company_name, co.address AS company_address,
              co.gstin AS company_gstin, co.pan AS company_pan,
              co.phone AS company_phone, co.email AS company_email,
              u.full_name AS creator_name, u.email AS creator_email
       FROM invoices i
       LEFT JOIN companies co ON i.company_id = co.id
       LEFT JOIN users u ON i.user_id = u.id
       WHERE i.id = ?`,
      [id]
    );
    const [newItems] = await pool.execute(
      'SELECT * FROM invoice_items WHERE invoice_id = ? ORDER BY sort_order ASC',
      [id]
    );

    res.status(201).json(formatInvoiceFull(newInv[0], newItems));
  } catch (err) {
    await conn.rollback();
    console.error('[Invoices/POST]', err);
    res.status(500).json({ error: 'Failed to create invoice.' });
  } finally {
    conn.release();
  }
});

// PUT /api/invoices/:id — Update an existing invoice
router.put('/:id', async (req, res) => {
  const {
    invoice_no, invoice_date, company_id, client_id,
    bill_to, ship_to, subject, hide_zero_tax,
    items, total_taxable_value, total_tax_amount, total_amount, amount_in_words,
    status
  } = req.body;

  if (!invoice_no || !invoice_date) {
    return res.status(400).json({ error: 'Invoice number and date are required.' });
  }

  const conn = await pool.getConnection();
  try {
    if (company_id) {
      const [comp] = await conn.execute('SELECT id FROM companies WHERE id = ? AND user_id = ?', [company_id, req.user.id]);
      if (comp.length === 0) {
        return res.status(400).json({ error: 'The selected seller company profile does not exist.' });
      }
    }
    if (client_id) {
      const [cli] = await conn.execute('SELECT id FROM clients WHERE id = ? AND user_id = ?', [client_id, req.user.id]);
      if (cli.length === 0) {
        return res.status(400).json({ error: 'The selected client/department does not exist.' });
      }
    }

    await conn.beginTransaction();

    // Verify ownership
    const [rows] = await conn.execute('SELECT id FROM invoices WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
    if (rows.length === 0) {
      await conn.rollback();
      return res.status(404).json({ error: 'Invoice not found.' });
    }

    // Update invoice
    await conn.execute(
      `UPDATE invoices SET
        company_id = ?, client_id = ?, invoice_no = ?, invoice_date = ?,
        subject = ?, bill_to_name = ?, bill_to_address = ?, bill_to_gstin = ?, bill_to_place_of_supply = ?,
        ship_to_name = ?, ship_to_address = ?,
        total_taxable_value = ?, total_tax_amount = ?, total_amount = ?, amount_in_words = ?,
        hide_zero_tax = ?, status = ?, updated_at = NOW()
       WHERE id = ? AND user_id = ?`,
      [
        company_id || null,
        client_id || null,
        invoice_no,
        invoice_date,
        subject || null,
        bill_to?.name || '',
        bill_to?.address || '',
        bill_to?.gstin || null,
        bill_to?.placeOfSupply || 'Maharashtra',
        ship_to?.name || bill_to?.name || '',
        ship_to?.address || bill_to?.address || '',
        total_taxable_value || 0,
        total_tax_amount || 0,
        total_amount || 0,
        amount_in_words || '',
        hide_zero_tax !== false ? 1 : 0,
        status || 'sent',
        req.params.id,
        req.user.id
      ]
    );

    // Delete existing items
    await conn.execute('DELETE FROM invoice_items WHERE invoice_id = ?', [req.params.id]);

    // Insert new items
    if (items && items.length > 0) {
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const itemId = item.id && item.id.length > 8 ? item.id : uuidv4();
        await conn.execute(
          `INSERT INTO invoice_items (id, invoice_id, sort_order, hsn, description, qty, unit, rate, tax_rate, tax_amount, amount)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            itemId, req.params.id, i,
            item.hsn || '-',
            item.description || '',
            item.qty || 0,
            item.unit || 'PCS',
            item.rate || 0,
            item.taxRate || 0,
            item.taxAmount || 0,
            item.amount || 0,
          ]
        );
      }
    }

    await conn.commit();

    // Fetch the updated invoice with full details
    const [newInv] = await pool.execute(
      `SELECT i.*, co.name AS company_name, co.address AS company_address,
              co.gstin AS company_gstin, co.pan AS company_pan,
              co.phone AS company_phone, co.email AS company_email,
              u.full_name AS creator_name, u.email AS creator_email
       FROM invoices i
       LEFT JOIN companies co ON i.company_id = co.id
       LEFT JOIN users u ON i.user_id = u.id
       WHERE i.id = ?`,
      [req.params.id]
    );
    const [newItems] = await pool.execute(
      'SELECT * FROM invoice_items WHERE invoice_id = ? ORDER BY sort_order ASC',
      [req.params.id]
    );

    res.json(formatInvoiceFull(newInv[0], newItems));
  } catch (err) {
    await conn.rollback();
    console.error('[Invoices/PUT]', err);
    res.status(500).json({ error: 'Failed to update invoice.' });
  } finally {
    conn.release();
  }
});

// PATCH /api/invoices/:id/status — Update invoice status
router.patch('/:id/status', async (req, res) => {
  const { status } = req.body;
  const validStatuses = ['draft', 'sent', 'paid', 'cancelled'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: `Status must be one of: ${validStatuses.join(', ')}` });
  }

  try {
    const [rows] = await pool.execute('SELECT id FROM invoices WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Invoice not found.' });

    await pool.execute(
      'UPDATE invoices SET status = ?, updated_at = NOW() WHERE id = ?',
      [status, req.params.id]
    );
    res.json({ message: `Invoice marked as ${status}.`, status });
  } catch (err) {
    console.error('[Invoices/PATCH status]', err);
    res.status(500).json({ error: 'Failed to update invoice status.' });
  }
});

// PATCH /api/invoices/:id/pdf-url — Save PDF cloud URL
router.patch('/:id/pdf-url', async (req, res) => {
  const { pdf_url } = req.body;
  if (!pdf_url) return res.status(400).json({ error: 'pdf_url is required.' });

  try {
    const [rows] = await pool.execute('SELECT id FROM invoices WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Invoice not found.' });

    await pool.execute(
      'UPDATE invoices SET pdf_url = ?, updated_at = NOW() WHERE id = ?',
      [pdf_url, req.params.id]
    );
    res.json({ message: 'PDF URL saved.', pdf_url });
  } catch (err) {
    console.error('[Invoices/PATCH pdf-url]', err);
    res.status(500).json({ error: 'Failed to save PDF URL.' });
  }
});

// DELETE /api/invoices/:id
router.delete('/:id', async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT id FROM invoices WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Invoice not found.' });

    // Items deleted by CASCADE on invoice_items table
    await pool.execute('DELETE FROM invoices WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
    res.json({ message: 'Invoice deleted.' });
  } catch (err) {
    console.error('[Invoices/DELETE]', err);
    res.status(500).json({ error: 'Failed to delete invoice.' });
  }
});

// GET /api/invoices/stats/summary — Dashboard stats
router.get('/stats/summary', async (req, res) => {
  try {
    const [totals] = await pool.execute(
      `SELECT 
        COUNT(*) as total_invoices,
        SUM(total_amount) as total_revenue,
        SUM(CASE WHEN status = 'sent' THEN total_amount ELSE 0 END) as outstanding,
        SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as pending_count
       FROM invoices WHERE user_id = ?`,
      [req.user.id]
    );
    const [clientCount] = await pool.execute('SELECT COUNT(*) as total FROM clients WHERE user_id = ?', [req.user.id]);

    res.json({
      totalRevenue: parseFloat(totals[0].total_revenue) || 0,
      outstanding: parseFloat(totals[0].outstanding) || 0,
      pendingCount: totals[0].pending_count || 0,
      totalInvoices: totals[0].total_invoices || 0,
      totalClients: clientCount[0].total || 0,
    });
  } catch (err) {
    console.error('[Invoices/stats]', err);
    res.status(500).json({ error: 'Failed to fetch stats.' });
  }
});

// ─── Formatters ────────────────────────────────────────────────────────────────

function formatInvoiceSummary(row) {
  return {
    id: row.id,
    invoiceNo: row.invoice_no,
    invoiceDate: row.invoice_date ? row.invoice_date.toISOString().split('T')[0] : '',
    status: row.status,
    totalAmount: parseFloat(row.total_amount) || 0,
    totalTaxableValue: parseFloat(row.total_taxable_value) || 0,
    totalTaxAmount: parseFloat(row.total_tax_amount) || 0,
    pdfUrl: row.pdf_url || null,
    billTo: { name: row.bill_to_name, address: row.bill_to_address, gstin: row.bill_to_gstin, placeOfSupply: row.bill_to_place_of_supply },
    createdAt: row.created_at,
    clientId: row.client_id,
    companyId: row.company_id,
  };
}

function formatInvoiceFull(row, items) {
  const company = row.company_id ? {
    id: row.company_id,
    name: row.company_name,
    address: row.company_address,
    gstin: row.company_gstin || '',
    pan: row.company_pan || '',
    phone: row.company_phone || '',
    email: row.company_email || '',
  } : null;

  return {
    id: row.id,
    invoiceNo: row.invoice_no,
    invoiceDate: row.invoice_date ? row.invoice_date.toISOString().split('T')[0] : '',
    status: row.status,
    clientId: row.client_id,
    companyId: row.company_id,
    company,
    subject: row.subject || '',
    hideZeroTax: row.hide_zero_tax === 1,
    billTo: {
      name: row.bill_to_name,
      address: row.bill_to_address || '',
      gstin: row.bill_to_gstin || '',
      placeOfSupply: row.bill_to_place_of_supply || 'Maharashtra',
    },
    shipTo: {
      name: row.ship_to_name || row.bill_to_name,
      address: row.ship_to_address || row.bill_to_address || '',
    },
    items: items.map(item => ({
      id: item.id,
      hsn: item.hsn || '-',
      description: item.description,
      qty: parseFloat(item.qty) || 0,
      unit: item.unit || 'PCS',
      rate: parseFloat(item.rate) || 0,
      taxRate: parseFloat(item.tax_rate) || 0,
      taxAmount: parseFloat(item.tax_amount) || 0,
      amount: parseFloat(item.amount) || 0,
    })),
    totalTaxableValue: parseFloat(row.total_taxable_value) || 0,
    totalTaxAmount: parseFloat(row.total_tax_amount) || 0,
    totalAmount: parseFloat(row.total_amount) || 0,
    amountInWords: row.amount_in_words || '',
    pdfUrl: row.pdf_url || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    createdBy: row.user_id,
    creatorName: row.creator_name || 'System User',
    creatorEmail: row.creator_email || '',
  };
}

module.exports = router;
