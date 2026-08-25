'use strict';

// Fiat currencies - rate stored as: 1 USD = X currency
const FIAT_CURRENCIES = ['THB', 'USD', 'CNY', 'GBP', 'EUR', 'JPY'];

// Precious metals - rate fetched from API, stored as: 1 USD = X metal (troy oz equivalent)
// Display is inverted: shown as "1 XAU = Y USD" for readability
const METAL_CURRENCIES = ['XAU', 'XAG'];

// Custom/crypto currencies - rate stored as: 1 currency = X USD (admin-set)
const CUSTOM_CURRENCIES = ['MBC'];

const CURRENCY_META = {
  THB: { symbol: '฿',   name: 'Thai Baht',        emoji: '🇹🇭', decimals: 2 },
  USD: { symbol: '$',   name: 'US Dollar',         emoji: '🇺🇸', decimals: 2 },
  CNY: { symbol: '¥',   name: 'Chinese Yuan',      emoji: '🇨🇳', decimals: 2 },
  GBP: { symbol: '£',   name: 'British Pound',     emoji: '🇬🇧', decimals: 2 },
  EUR: { symbol: '€',   name: 'Euro',              emoji: '🇪🇺', decimals: 2 },
  JPY: { symbol: '¥',   name: 'Japanese Yen',      emoji: '🇯🇵', decimals: 0 },
  XAU: { symbol: 'XAU', name: 'Gold (Troy Oz)',    emoji: '🥇', decimals: 6 },
  XAG: { symbol: 'XAG', name: 'Silver (Troy Oz)',  emoji: '🥈', decimals: 4 },
  MBC: { symbol: 'MBC', name: 'Miyabi Coin',       emoji: '💎', decimals: 4 },
};

const SUPPORTED_CURRENCIES = Object.keys(CURRENCY_META);

/**
 * Format a numeric amount for display.
 * @param {string|number} amount
 * @param {string} currency - uppercase
 */
function formatAmount(amount, currency) {
  const cur = currency.toUpperCase();
  const meta = CURRENCY_META[cur];
  if (!meta) return `${parseFloat(amount).toFixed(8)} ${cur}`;

  const num = parseFloat(amount);
  return `${num.toLocaleString('en-US', {
    minimumFractionDigits: meta.decimals,
    maximumFractionDigits: meta.decimals,
  })} ${cur}`;
}

/**
 * Format with symbol prefix.
 */
function formatWithSymbol(amount, currency) {
  const cur = currency.toUpperCase();
  const meta = CURRENCY_META[cur];
  if (!meta) return formatAmount(amount, cur);

  const num = parseFloat(amount);
  const isFiat = FIAT_CURRENCIES.includes(cur);

  if (isFiat) {
    return `${meta.symbol}${num.toLocaleString('en-US', {
      minimumFractionDigits: meta.decimals,
      maximumFractionDigits: meta.decimals,
    })}`;
  }
  return `${num.toFixed(meta.decimals)} ${meta.symbol}`;
}

/**
 * Get emoji for a currency.
 */
function currencyEmoji(currency) {
  const meta = CURRENCY_META[currency.toUpperCase()];
  return meta ? meta.emoji : '💰';
}

/**
 * Validate if a currency string is supported.
 */
function isValidCurrency(currency) {
  return SUPPORTED_CURRENCIES.includes(currency.toUpperCase());
}

/**
 * Parse and validate an amount string. Returns null on invalid.
 */
function parseAmount(input) {
  const num = parseFloat(input);
  if (isNaN(num) || num <= 0 || !isFinite(num)) return null;
  // Max 8 decimal places
  return parseFloat(num.toFixed(8));
}

/**
 * Human-readable transaction type labels.
 */
const TX_TYPE_LABELS = {
  deposit: '📥 Deposit',
  withdraw: '📤 Withdraw',
  transfer_in: '⬇️ Received',
  transfer_out: '⬆️ Sent',
  exchange: '🔄 Exchange',
  staking_reward: '🏆 Staking Reward',
  escrow_lock: '🔒 Escrow Lock',
  escrow_release: '🔓 Escrow Release',
  escrow_cancel: '❌ Escrow Cancelled',
  split_out: '🧾 Split Bill (Paid)',
  split_in: '🧾 Split Bill (Received)',
  external_in: '🌐 External Receive',
  external_out: '🌐 External Send',
};

module.exports = {
  FIAT_CURRENCIES,
  METAL_CURRENCIES,
  CUSTOM_CURRENCIES,
  CURRENCY_META,
  SUPPORTED_CURRENCIES,
  formatAmount,
  formatWithSymbol,
  currencyEmoji,
  isValidCurrency,
  parseAmount,
  TX_TYPE_LABELS,
};
