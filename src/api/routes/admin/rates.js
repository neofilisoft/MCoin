'use strict';
const express = require('express');
const stakingQ = require('../../../db/queries/staking');
const { getRates, invalidateCache } = require('../../../services/rateService');

const router = express.Router();

/**
 * GET /admin/rates
 * Get all current rates (fiat + custom).
 */
router.get('/', async (req, res) => {
  try {
    const rates = await getRates();
    const customRates = await stakingQ.getCustomRates();
    res.json({ rates, customRates });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * PUT /admin/rates/:currency
 * Update the rate for MBC only.
 * XAU and XAG are fetched from ExchangeRate-API automatically.
 */
router.put('/:currency', async (req, res) => {
  const currency = req.params.currency.toUpperCase();
  if (currency !== 'MBC') {
    return res.status(400).json({
      error: `Only MBC can be set manually. XAU and XAG are real spot prices from ExchangeRate-API.`,
    });
  }

  const { rateInUsd } = req.body;
  const rate = parseFloat(rateInUsd);
  if (isNaN(rate) || rate <= 0) {
    return res.status(400).json({ error: 'Invalid rateInUsd value.' });
  }

  try {
    // Use 'admin' as updatedBy if no discord_id provided
    const updatedBy = req.body.updatedBy || 'admin-api';
    await stakingQ.setCustomRate(currency, rate, updatedBy);
    invalidateCache();
    res.json({ success: true, currency, rateInUsd: rate });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /admin/staking/config
 * Get current staking APR.
 */
router.get('/staking/config', async (req, res) => {
  try {
    const apr = await stakingQ.getStakingApr();
    res.json({ apr, aprPercent: `${(apr * 100).toFixed(2)}%` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * PUT /admin/staking/config
 * Update staking APR (affects new stakes only).
 * Body: { apr: number } - decimal e.g. 0.12 for 12%
 */
router.put('/staking/config', async (req, res) => {
  const { apr } = req.body;
  const aprNum = parseFloat(apr);
  if (isNaN(aprNum) || aprNum < 0 || aprNum > 5) {
    return res.status(400).json({ error: 'APR must be between 0 and 5 (decimal, e.g. 0.12 for 12%).' });
  }

  try {
    await stakingQ.setStakingApr(aprNum);
    res.json({ success: true, apr: aprNum, aprPercent: `${(aprNum * 100).toFixed(2)}%` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
