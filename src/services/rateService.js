'use strict';
require('dotenv').config();
const axios = require('axios');
const { getCustomRates } = require('../db/queries/staking');
const { FIAT_CURRENCIES, METAL_CURRENCIES } = require('../utils/currency');

// Cache TTLs
const FIAT_CACHE_TTL_MS   = parseInt(process.env.RATE_CACHE_TTL_MS    || '3600000');  // 1 hour
const METALS_CACHE_TTL_MS = parseInt(process.env.METALS_CACHE_TTL_MS  || '1800000');  // 30 min

// All API-fetched currencies stored as: 1 USD = X currency
const API_FETCHED_CURRENCIES = [...FIAT_CURRENCIES, ...METAL_CURRENCIES];

// Separate caches for fiat and metals so metals can refresh independently
let fiatCache   = { rates: {}, fetchedAt: 0 };
let metalsCache = { rates: {}, fetchedAt: 0 };
let customCache = { rates: {}, fetchedAt: 0 };

// Fallback rates (in case APIs are unreachable)
const FALLBACK_METALS_USD_PER_OZ = { XAU: 3300.0, XAG: 33.0 };
const FALLBACK_FIAT = {
  THB: 35.0, USD: 1.0, CNY: 7.3, GBP: 0.79, EUR: 0.92, JPY: 149.0,
};

// ============================================================
// Fiat rates - ExchangeRate-API (v6)
// Format returned: 1 USD = X currency
// ============================================================
async function fetchFiatRates() {
  const apiKey = process.env.EXCHANGE_RATE_API_KEY;
  if (!apiKey) {
    console.warn('[RateService] EXCHANGE_RATE_API_KEY not set - using fallback fiat rates.');
    return FALLBACK_FIAT;
  }

  const resp = await axios.get(
    `https://v6.exchangerate-api.com/v6/${apiKey}/latest/USD`,
    { timeout: 10000 }
  );

  if (resp.data.result !== 'success') {
    throw new Error(`ExchangeRate-API error: ${resp.data['error-type']}`);
  }

  const c = resp.data.conversion_rates;
  return {
    THB: c.THB,
    USD: 1.0,
    CNY: c.CNY,
    GBP: c.GBP,
    EUR: c.EUR,
    JPY: c.JPY,
  };
}

// ============================================================
// Metal rates - goldapi.io
// Response: { price: <USD per troy oz>, ... }
// We store as: 1 USD = 1/price XAU (same direction as fiat)
// ============================================================
async function fetchMetalRate(symbol) {
  const apiKey = process.env.XAU_API_KEY;
  if (!apiKey) {
    const fallback = FALLBACK_METALS_USD_PER_OZ[symbol];
    console.warn(`[RateService] XAU_API_KEY not set - using fallback ${symbol}: $${fallback}/oz`);
    return 1 / fallback;
  }

  // goldapi.io endpoint: GET /api/{SYMBOL}/{CURRENCY}
  const resp = await axios.get(
    `https://www.goldapi.io/api/${symbol}/USD`,
    {
      headers: {
        'x-access-token': apiKey,
        'Content-Type': 'application/json',
      },
      timeout: 10000,
    }
  );

  if (!resp.data || !resp.data.price) {
    throw new Error(`goldapi.io did not return a price for ${symbol}`);
  }

  const usdPerOz = parseFloat(resp.data.price);
  console.log(`[RateService] ${symbol} spot price: $${usdPerOz.toFixed(2)}/oz (goldapi.io)`);

  // Store as: 1 USD = (1/usdPerOz) XAU
  return 1 / usdPerOz;
}

async function fetchMetalRates() {
  // Fetch XAU and XAG in parallel
  const [xauRate, xagRate] = await Promise.all([
    fetchMetalRate('XAU').catch((err) => {
      console.error('[RateService] XAU fetch failed:', err.message, '- using fallback');
      return 1 / FALLBACK_METALS_USD_PER_OZ.XAU;
    }),
    fetchMetalRate('XAG').catch((err) => {
      console.error('[RateService] XAG fetch failed:', err.message, '- using fallback');
      return 1 / FALLBACK_METALS_USD_PER_OZ.XAG;
    }),
  ]);

  return { XAU: xauRate, XAG: xagRate };
}

// ============================================================
// getRates() - merge fiat + metals + custom with independent caches
// ============================================================

/**
 * Get all rates. Each source has its own cache TTL.
 *
 * Rate format:
 *   Fiat + Metals : 1 USD = X currency  (rates[THB]=35, rates[XAU]=0.000303)
 *   Custom (MBC)  : 1 MBC = X USD       (rates[MBC]=1.0)
 */
async function getRates() {
  const now = Date.now();

  // Refresh fiat if stale
  if (now - fiatCache.fetchedAt >= FIAT_CACHE_TTL_MS) {
    try {
      fiatCache.rates = await fetchFiatRates();
      fiatCache.fetchedAt = now;
    } catch (err) {
      console.error('[RateService] Fiat fetch failed:', err.message);
      if (Object.keys(fiatCache.rates).length === 0) fiatCache.rates = FALLBACK_FIAT;
    }
  }

  // Refresh metals if stale
  if (now - metalsCache.fetchedAt >= METALS_CACHE_TTL_MS) {
    try {
      metalsCache.rates = await fetchMetalRates();
      metalsCache.fetchedAt = now;
    } catch (err) {
      console.error('[RateService] Metals fetch failed:', err.message);
      if (Object.keys(metalsCache.rates).length === 0) {
        metalsCache.rates = {
          XAU: 1 / FALLBACK_METALS_USD_PER_OZ.XAU,
          XAG: 1 / FALLBACK_METALS_USD_PER_OZ.XAG,
        };
      }
    }
  }

  // Refresh custom rates (MBC) - reuse fiat TTL
  if (now - customCache.fetchedAt >= FIAT_CACHE_TTL_MS) {
    try {
      const custom = await getCustomRates();
      customCache.rates = {
        MBC: custom.MBC ?? parseFloat(process.env.MBC_INITIAL_RATE_USD || '1'),
      };
      customCache.fetchedAt = now;
    } catch (err) {
      console.error('[RateService] Custom rates fetch failed:', err.message);
      if (!customCache.rates.MBC) customCache.rates.MBC = 1;
    }
  }

  return {
    ...fiatCache.rates,
    ...metalsCache.rates,
    ...customCache.rates,
  };
}

/**
 * Invalidate all caches (call after admin updates a rate).
 */
function invalidateCache() {
  fiatCache.fetchedAt   = 0;
  metalsCache.fetchedAt = 0;
  customCache.fetchedAt = 0;
}

/**
 * Invalidate only the metals cache (force refresh on next getRates call).
 */
function invalidateMetalsCache() {
  metalsCache.fetchedAt = 0;
}

// ============================================================
// Currency conversion - all via USD pivot
// ============================================================

/**
 * Convert amount from one currency to another.
 *
 * API_FETCHED (fiat + metals): rates[CUR] = units-of-CUR per 1 USD
 *   to USD:   amount / rates[CUR]           (e.g. 35 THB / 35 = 1 USD)
 *   from USD: amountUSD * rates[CUR]         (e.g. 1 USD * 0.000303 = XAU)
 *
 * CUSTOM (MBC): rates[MBC] = USD value of 1 MBC
 *   to USD:   amount * rates[MBC]
 *   from USD: amountUSD / rates[MBC]
 */
function convert(amount, from, to, rates) {
  const fromUpper = from.toUpperCase();
  const toUpper   = to.toUpperCase();

  if (fromUpper === toUpper) return { toAmount: amount, rate: 1 };

  // Step 1: source → USD
  let amountInUsd;
  if (fromUpper === 'USD') {
    amountInUsd = amount;
  } else if (API_FETCHED_CURRENCIES.includes(fromUpper)) {
    amountInUsd = amount / rates[fromUpper];
  } else {
    // Custom (MBC): rate is USD-per-unit
    amountInUsd = amount * rates[fromUpper];
  }

  // Step 2: USD → destination
  let toAmount;
  if (toUpper === 'USD') {
    toAmount = amountInUsd;
  } else if (API_FETCHED_CURRENCIES.includes(toUpper)) {
    toAmount = amountInUsd * rates[toUpper];
  } else {
    toAmount = amountInUsd / rates[toUpper];
  }

  const rate = toAmount / amount;
  return { toAmount, rate };
}

/**
 * Get the USD value of 1 unit of a currency (for display).
 *   Fiat:   1/rates[THB] = 0.0286 USD per THB
 *   Metal:  1/rates[XAU] = 3300  USD per troy oz
 *   Custom: rates[MBC]  = 1.0   USD per MBC
 */
function getUsdValue(currency, rates) {
  const cur = currency.toUpperCase();
  if (cur === 'USD') return 1;
  if (API_FETCHED_CURRENCIES.includes(cur)) return 1 / rates[cur];
  return rates[cur];
}

module.exports = {
  getRates,
  invalidateCache,
  invalidateMetalsCache,
  convert,
  getUsdValue,
  FIAT_CURRENCIES,
  METAL_CURRENCIES,
  API_FETCHED_CURRENCIES,
};
