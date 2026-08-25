'use strict';
const express = require('express');
const walletService = require('../../../services/walletService');
const { isValidCurrency, parseAmount } = require('../../../utils/currency');

const router = express.Router();

/**
 * GET /admin/wallets/:discordId
 * Get wallet details for a user.
 */
router.get('/:discordId', async (req, res) => {
  try {
    const wallet = await walletService.getWallet(req.params.discordId);
    if (!wallet) return res.status(404).json({ error: 'Wallet not found' });
    res.json({ wallet });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /admin/wallets/:discordId/mint
 * Mint currency from Master Wallet to a user's wallet.
 * Body: { currency, amount, note? }
 */
router.post('/:discordId/mint', async (req, res) => {
  const { currency, amount, note } = req.body;

  if (!currency || !isValidCurrency(currency)) {
    return res.status(400).json({ error: 'Invalid or missing currency' });
  }
  const parsedAmount = parseAmount(amount);
  if (!parsedAmount) {
    return res.status(400).json({ error: 'Invalid or missing amount' });
  }

  try {
    const txid = await walletService.mint(req.params.discordId, currency, parsedAmount, note || null);
    const wallet = await walletService.getWallet(req.params.discordId);
    res.json({ success: true, txid, wallet });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * POST /admin/wallets/:discordId/burn
 * Burn currency from a user's wallet back to Master Wallet.
 * Body: { currency, amount, note? }
 */
router.post('/:discordId/burn', async (req, res) => {
  const { currency, amount, note } = req.body;

  if (!currency || !isValidCurrency(currency)) {
    return res.status(400).json({ error: 'Invalid or missing currency' });
  }
  const parsedAmount = parseAmount(amount);
  if (!parsedAmount) {
    return res.status(400).json({ error: 'Invalid or missing amount' });
  }

  try {
    const txid = await walletService.burn(req.params.discordId, currency, parsedAmount, note || null);
    const wallet = await walletService.getWallet(req.params.discordId);
    res.json({ success: true, txid, wallet });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
