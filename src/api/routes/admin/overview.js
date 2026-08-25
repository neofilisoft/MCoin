'use strict';
const express = require('express');
const walletService = require('../../../services/walletService');
const stakingQ = require('../../../db/queries/staking');
const { getRates } = require('../../../services/rateService');

const router = express.Router();

/**
 * GET /admin/overview
 * Get Master Wallet balances, current rates, and staking config.
 */
router.get('/', async (req, res) => {
  try {
    const [masterWallet, rates, apr] = await Promise.all([
      walletService.getMasterWallet(),
      getRates(),
      stakingQ.getStakingApr(),
    ]);

    res.json({
      masterWallet,
      rates,
      staking: {
        apr,
        aprPercent: `${(apr * 100).toFixed(2)}%`,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
