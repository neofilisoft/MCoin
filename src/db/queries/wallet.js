'use strict';
const pool = require('../connection');

const CURRENCIES = ['thb', 'usd', 'cny', 'gbp', 'eur', 'jpy', 'xau', 'xag', 'mbc'];

/**
 * Get wallet by user_id.
 */
async function getWalletByUserId(userId) {
  if (!userId) return null;
  const [rows] = await pool.query(
    'SELECT * FROM wallets WHERE user_id = ? LIMIT 1',
    [userId]
  );
  return rows[0] || null;
}

/**
 * Get wallet by discord_id.
 */
async function getWallet(discordId) {
  if (!discordId) return null;
  const [rows] = await pool.query(
    'SELECT * FROM wallets WHERE discord_id = ? LIMIT 1',
    [discordId]
  );
  return rows[0] || null;
}

/**
 * Get wallet by wallet_address.
 */
async function getWalletByAddress(address) {
  if (!address) return null;
  const [rows] = await pool.query(
    'SELECT * FROM wallets WHERE wallet_address = ? LIMIT 1',
    [address]
  );
  return rows[0] || null;
}

/**
 * Create a new wallet for a user.
 */
async function createWalletForUser(userId, walletAddress, discordId = null) {
  const [result] = await pool.query(
    'INSERT INTO wallets (user_id, discord_id, wallet_address) VALUES (?, ?, ?)',
    [userId, discordId || null, walletAddress]
  );
  return getWalletByUserId(userId);
}

/**
 * Create a new wallet for a Discord user (backward compatibility).
 */
async function createWallet(discordId, walletAddress) {
  const [result] = await pool.query(
    'INSERT INTO wallets (discord_id, wallet_address) VALUES (?, ?)',
    [discordId, walletAddress]
  );
  return getWallet(discordId);
}

/**
 * Get or create a wallet for a Discord user.
 */
async function getOrCreateWallet(discordId, addressGenerator) {
  let wallet = await getWallet(discordId);
  if (!wallet) {
    const address = addressGenerator(discordId);
    wallet = await createWallet(discordId, address);
  }
  return wallet;
}

/**
 * Adjust a user's balance for a specific currency within a transaction.
 * Target can be a userId (number or numeric string) or a discordId (string).
 * Throws if result would be < 0.
 *
 * @param {object} conn - mysql2 connection (within transaction)
 * @param {number|string} target - userId or discordId
 * @param {string} currency - currency code
 * @param {string|number} amount - positive (credit) or negative (debit)
 */
async function adjustBalance(conn, target, currency, amount) {
  if (!CURRENCIES.includes(currency.toLowerCase())) {
    throw new Error(`Unknown currency: ${currency}`);
  }
  const col = currency.toLowerCase();

  // Determine query condition: numeric ID -> check user_id first, then discord_id
  let rows;
  let whereCol;
  let whereVal;

  if (typeof target === 'number' || (/^\d+$/.test(target) && String(target).length < 15)) {
    whereCol = 'user_id';
    whereVal = target;
    [rows] = await conn.query(
      `SELECT id, ${col} FROM wallets WHERE user_id = ? FOR UPDATE`,
      [target]
    );
  }

  // If not found by user_id or target looks like a discord_id
  if (!rows || rows.length === 0) {
    whereCol = 'discord_id';
    whereVal = target;
    [rows] = await conn.query(
      `SELECT id, ${col} FROM wallets WHERE discord_id = ? FOR UPDATE`,
      [target]
    );
  }

  if (!rows || !rows[0]) {
    throw new Error(`Wallet not found for user ${target}`);
  }

  const current = parseFloat(rows[0][col]);
  const delta = parseFloat(amount);
  const next = current + delta;

  if (next < 0) {
    throw new Error(`Insufficient ${currency.toUpperCase()} balance`);
  }

  await conn.query(
    `UPDATE wallets SET ${col} = ? WHERE ${whereCol} = ?`,
    [next.toFixed(8), whereVal]
  );

  return next;
}

/**
 * Adjust master wallet balance for a currency within a transaction.
 */
async function adjustMasterBalance(conn, currency, amount) {
  const cur = currency.toUpperCase();
  const [rows] = await conn.query(
    'SELECT balance FROM master_wallet WHERE currency = ? FOR UPDATE',
    [cur]
  );
  if (!rows[0]) throw new Error(`Master wallet currency not found: ${cur}`);

  const current = parseFloat(rows[0].balance);
  const delta = parseFloat(amount);
  const next = current + delta;

  if (next < 0) {
    throw new Error(`Master wallet insufficient ${cur} reserve`);
  }

  await conn.query(
    'UPDATE master_wallet SET balance = ? WHERE currency = ?',
    [next.toFixed(8), cur]
  );

  return next;
}

/**
 * Get master wallet balances.
 */
async function getMasterWallet() {
  const [rows] = await pool.query('SELECT * FROM master_wallet');
  return rows;
}

/**
 * Link wallet to a user ID.
 */
async function linkWalletToUser(walletId, userId) {
  await pool.query('UPDATE wallets SET user_id = ? WHERE id = ?', [userId, walletId]);
}

module.exports = {
  CURRENCIES,
  getWallet,
  getWalletByUserId,
  getWalletByAddress,
  createWallet,
  createWalletForUser,
  getOrCreateWallet,
  adjustBalance,
  adjustMasterBalance,
  getMasterWallet,
  linkWalletToUser,
};
