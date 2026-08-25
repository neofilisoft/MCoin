'use strict';
const express = require('express');
const { getRates, getUsdValue, FIAT_CURRENCIES, METAL_CURRENCIES } = require('../../../services/rateService');
const { CURRENCY_META } = require('../../../utils/currency');

const router = express.Router();

/**
 * GET /api/v1/rates
 * Public endpoint to fetch all live rates and currency metadata.
 */
router.get('/', async (req, res) => {
  try {
    const rates = await getRates();

    // Build structured rate view with USD values
    const currencies = Object.keys(CURRENCY_META).map((code) => {
      const meta = CURRENCY_META[code];
      const usdValue = getUsdValue(code, rates);
      const isFiat = FIAT_CURRENCIES.includes(code);
      const isMetal = METAL_CURRENCIES.includes(code);

      return {
        code,
        name: meta.name,
        symbol: meta.symbol,
        emoji: meta.emoji,
        decimals: meta.decimals,
        type: isFiat ? 'fiat' : (isMetal ? 'metal' : 'crypto'),
        rateToUsd: usdValue,
        rawRate: rates[code],
      };
    });

    res.json({
      rates,
      currencies,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
