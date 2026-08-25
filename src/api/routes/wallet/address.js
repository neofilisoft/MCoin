'use strict';
const express = require('express');
const walletService = require('../../../services/walletService');

const router = express.Router();

/**
 * GET /wallet/address/:discordId
 * Get wallet address (and QR code URL) for a Discord user.
 * Creates wallet if it doesn't exist.
 */
router.get('/address/:discordId', async (req, res) => {
  try {
    const wallet = await walletService.getOrCreateWallet(req.params.discordId);
    // QR code via a free public API
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(wallet.wallet_address)}`;

    res.json({
      discord_id: wallet.discord_id,
      wallet_address: wallet.wallet_address,
      qr_code_url: qrUrl,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
