// server.js — GovBill Pro Express + MySQL Backend
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const authRoutes = require('./routes/auth');
const clientRoutes = require('./routes/clients');
const companyRoutes = require('./routes/companies');
const invoiceRoutes = require('./routes/invoices');

const app = express();
const PORT = process.env.PORT || 4000;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

// ─── Middleware ──────────────────────────────────────────────────────────────
app.use(cors({
  origin: [FRONTEND_URL, 'http://localhost:3000', 'http://localhost:5173'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ─── Request Logger (dev) ────────────────────────────────────────────────────
app.use((req, _res, next) => {
  const ts = new Date().toLocaleTimeString('en-IN');
  console.log(`[${ts}] ${req.method} ${req.path}`);
  next();
});

// ─── Routes ──────────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/companies', companyRoutes);
app.use('/api/invoices', invoiceRoutes);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    server: 'GovBill Pro API',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

// ─── 404 Handler ─────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: 'Route not found.' });
});

// ─── Global Error Handler ────────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error.' });
});

// ─── Start Server ────────────────────────────────────────────────────────────
app.listen(PORT, '0.0.0.0', () => {
  console.log('');
  console.log('╔══════════════════════════════════════╗');
  console.log('║      GovBill Pro — API Server        ║');
  console.log('╚══════════════════════════════════════╝');
  console.log(`  🌐 API:       http://localhost:${PORT}/api`);
  console.log(`  ❤️  Health:   http://localhost:${PORT}/api/health`);
  console.log(`  🔌 Frontend:  ${FRONTEND_URL}`);
  console.log('');
});

module.exports = app;
