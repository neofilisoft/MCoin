'use strict';
const express = require('express');
const walletService = require('../../../services/walletService');
const transferService = require('../../../services/transferService');
const exchangeService = require('../../../services/exchangeService');
const userService = require('../../../services/userService');
const txQ = require('../../../db/queries/transaction');
const { requireUserAuth } = require('../../middleware/userAuth');

const router = express.Router();
router.use(requireUserAuth);

/**
 * GET /api/v1/wallet/me
 * Get current user's wallet balance and address.
 */
router.get('/me', async (req, res) => {
  try {
    const wallet = await walletService.getWalletByUserId(req.user.id);
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(wallet.wallet_address)}`;

    const { id, user_id, discord_id, wallet_address, created_at, updated_at, ...balances } = wallet;

    res.json({
      wallet: {
        wallet_address,
        balances,
        qr_code_url: qrUrl,
        created_at,
        updated_at,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/v1/wallet/history
 * Get transaction history with pagination and filters.
 */
router.get('/history', async (req, res) => {
  const { currency, type, page = 1, pageSize = 15 } = req.query;

  try {
    const history = await txQ.getHistory(req.user.id, {
      currency: currency || null,
      type: type || null,
      page: parseInt(page, 10) || 1,
      pageSize: Math.min(parseInt(pageSize, 10) || 15, 50),
    });

    res.json(history);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/v1/wallet/transfer
 * P2P transfer to another user.
 * Body: { recipient, currency, amount, note? }
 */
router.post('/transfer', async (req, res) => {
  const { recipient, currency, amount, note } = req.body;

  if (!recipient) return res.status(400).json({ error: 'recipient is required' });
  if (!currency) return res.status(400).json({ error: 'currency is required' });
  if (!amount) return res.status(400).json({ error: 'amount is required' });

  try {
    const txid = await transferService.transfer(
      req.user.id,
      recipient,
      currency,
      amount,
      note || null
    );

    const wallet = await walletService.getWalletByUserId(req.user.id);
    res.json({ success: true, txid, wallet });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * POST /api/v1/wallet/exchange
 * Swap currencies within own wallet.
 * Body: { fromCurrency, toCurrency, amount }
 */
router.post('/exchange', async (req, res) => {
  const { fromCurrency, toCurrency, amount } = req.body;

  if (!fromCurrency || !toCurrency) {
    return res.status(400).json({ error: 'fromCurrency and toCurrency are required' });
  }
  if (!amount) return res.status(400).json({ error: 'amount is required' });

  try {
    const result = await exchangeService.exchange(
      req.user.id,
      fromCurrency,
      toCurrency,
      amount
    );

    const wallet = await walletService.getWalletByUserId(req.user.id);
    res.json({ success: true, ...result, wallet });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * GET /api/v1/wallet/users/search
 * Search users for transfer/request autocomplete.
 */
router.get('/users/search', async (req, res) => {
  const query = req.query.q;
  if (!query || query.trim().length < 2) {
    return res.json({ users: [] });
  }

  try {
    const pool = require('../../../db/connection');
    const q = `%${query.trim()}%`;
    const [rows] = await pool.query(
      `SELECT u.id, u.username, u.display_name, u.avatar_url, w.wallet_address
       FROM users u
       LEFT JOIN wallets w ON w.user_id = u.id
       WHERE (u.username LIKE ? OR u.display_name LIKE ? OR u.email LIKE ? OR w.wallet_address = ?)
         AND u.is_active = 1
       LIMIT 10`,
      [q, q, q, query.trim()]
    );

    res.json({ users: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
