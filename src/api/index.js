'use strict';
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { requireApiKey } = require('./middleware/auth');
const { initScheduler } = require('../services/scheduler');

const app = express();

// Enable CORS for frontend web apps
app.use(cors({
  origin: '*', // In production, restrict to configured frontend origins
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Admin-Key', 'X-Wallet-Key', 'X-Institution-Key', 'X-Api-Key'],
}));

app.use(express.json());

// ============================================================
// MCoin 1.3 - Modern RESTful User API (/api/v1/*)
// ============================================================
app.use('/api/v1/auth', require('./routes/auth/index'));
app.use('/api/v1/wallet', require('./routes/user/wallet'));
app.use('/api/v1/escrows', require('./routes/user/escrows'));
app.use('/api/v1/requests', require('./routes/user/requests'));
app.use('/api/v1/splits', require('./routes/user/splits'));
app.use('/api/v1/staking', require('./routes/user/staking'));
app.use('/api/v1/rates', require('./routes/public/rates'));

// ============================================================
// Legacy & Admin Endpoints (Backward Compatible)
// ============================================================

// --- Admin API (protected by ADMIN_API_KEY) ---
const adminAuth = requireApiKey('ADMIN_API_KEY');
app.use('/admin/wallets', adminAuth, require('./routes/admin/wallets'));
app.use('/admin/rates', adminAuth, require('./routes/admin/rates'));
app.use('/admin/overview', adminAuth, require('./routes/admin/overview'));
app.use('/admin/institutions', require('./routes/admin/institutions'));

// --- External Wallet API (protected by WALLET_API_KEY) ---
const walletAuth = requireApiKey('WALLET_API_KEY');
app.use('/wallet', walletAuth, require('./routes/wallet/address'));
app.use('/wallet', walletAuth, require('./routes/wallet/balance'));
app.use('/wallet', walletAuth, require('./routes/wallet/pay'));

// --- Institution API (protected by per-institution X-Institution-Key) ---
app.use('/institution', require('./routes/institution/index'));

// --- Health check (public) ---
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    version: '1.3.0',
    service: 'MCoin Central Bank & API',
    timestamp: new Date().toISOString(),
  });
});

// --- 404 handler ---
app.use((req, res) => {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.path}` });
});

// --- Global Error handler ---
app.use((err, req, res, next) => {
  console.error('[API Error]', err);
  res.status(500).json({ error: 'Internal server error', message: err.message });
});

const PORT = parseInt(process.env.API_PORT || '3001', 10);

if (require.main === module) {
  // Initialize scheduler if API is started standalone
  initScheduler();

  app.listen(PORT, () => {
    console.log(`[API] MCoin Central Bank API v1.3 running on http://localhost:${PORT}`);
    console.log(`[API] User REST API: /api/v1/auth, /api/v1/wallet, /api/v1/escrows, /api/v1/requests, /api/v1/splits, /api/v1/staking, /api/v1/rates`);
    console.log(`[API] Admin & BaaS: /admin/*, /wallet/*, /institution/*`);
  });
}

module.exports = app;
