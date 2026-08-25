'use strict';
const express = require('express');
const walletService = require('../../../services/walletService');

const router = express.Router();

/**
 * GET /wallet/balance/:address
 * Get balance for a wallet by its address.
 */
router.get('/balance/:address', async (req, res) => {
  try {
    const wallet = await walletService.getWalletByAddress(req.params.address);
    if (!wallet) return res.status(404).json({ error: 'Wallet not found' });

    const { id, discord_id, wallet_address, thb, usd, cny, gbp, eur, aux, mbc, created_at } = wallet;
    res.json({
      wallet_address,
      discord_id,
      balances: { thb, usd, cny, gbp, eur, aux, mbc },
      created_at,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /wallet/balance/by-discord/:discordId
 * Get balance by Discord ID.
 */
router.get('/balance/by-discord/:discordId', async (req, res) => {
  try {
    const wallet = await walletService.getWallet(req.params.discordId);
    if (!wallet) return res.status(404).json({ error: 'Wallet not found' });

    const { wallet_address, thb, usd, cny, gbp, eur, aux, mbc, created_at } = wallet;
    res.json({
      wallet_address,
      discord_id: req.params.discordId,
      balances: { thb, usd, cny, gbp, eur, aux, mbc },
      created_at,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
