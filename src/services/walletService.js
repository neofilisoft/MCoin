'use strict';
const pool = require('../db/connection');
const walletQ = require('../db/queries/wallet');
const userQ = require('../db/queries/user');
const txQ = require('../db/queries/transaction');
const { generateWalletAddress } = require('../utils/address');

/**
 * Get or create wallet for a Discord user.
 */
async function getOrCreateWallet(discordId) {
  let wallet = await walletQ.getWallet(discordId);
  if (!wallet) {
    // Also ensure user record exists
    const userService = require('./userService');
    const user = await userService.getOrCreateUserForDiscord(discordId);
    wallet = await walletQ.getWalletByUserId(user.id);
    if (!wallet) {
      const address = generateWalletAddress(discordId);
      wallet = await walletQ.createWalletForUser(user.id, address, discordId);
    }
  }
  return wallet;
}

/**
 * Get wallet by user ID.
 */
async function getWalletByUserId(userId) {
  let wallet = await walletQ.getWalletByUserId(userId);
  if (!wallet) {
    const user = await userQ.getUserById(userId);
    if (user) {
      const address = generateWalletAddress(`user_${user.id}`);
      wallet = await walletQ.createWalletForUser(user.id, address, user.discord_id || null);
    }
  }
  return wallet;
}

/**
 * Get wallet by various identifier formats (userId, username, email, walletAddress, discordId).
 */
async function getWalletByIdentifier(identifier) {
  if (!identifier) return null;

  // 1. Direct address check
  if (String(identifier).startsWith('mc') && String(identifier).length >= 40) {
    return walletQ.getWalletByAddress(identifier);
  }

  // 2. User lookup
  const user = await userQ.findUserByQuery(identifier);
  if (user) {
    return getWalletByUserId(user.id);
  }

  // 3. Direct discord lookup
  return walletQ.getWallet(identifier);
}

/**
 * Mint currency from Master Wallet into a user's wallet.
 * Called by Admin API. Target can be userId, username, email, address, or discordId.
 */
async function mint(target, currency, amount, note = null) {
  const cur = currency.toUpperCase();
  const amt = parseFloat(amount);

  if (amt <= 0) throw new Error('Amount must be positive');

  const wallet = await getWalletByIdentifier(target);
  if (!wallet) {
    // If target looks like discordId, try to provision
    if (/^\d{17,20}$/.test(String(target))) {
      await getOrCreateWallet(String(target));
    } else {
      throw new Error(`Wallet not found for "${target}"`);
    }
  }

  const resolvedWallet = await getWalletByIdentifier(target);

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Deduct from Master Wallet reserve
    await walletQ.adjustMasterBalance(conn, cur, -amt);

    // Credit user wallet
    await walletQ.adjustBalance(conn, resolvedWallet.user_id || resolvedWallet.discord_id, cur, amt);

    // Record transaction
    const txid = await txQ.insertTransaction(conn, {
      userId: resolvedWallet.user_id || null,
      discordId: resolvedWallet.discord_id || null,
      type: 'deposit',
      currency: cur,
      amount: amt,
      note,
    });

    await conn.commit();
    return txid;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

/**
 * Burn currency from a user's wallet back to Master Wallet.
 */
async function burn(target, currency, amount, note = null) {
  const cur = currency.toUpperCase();
  const amt = parseFloat(amount);

  if (amt <= 0) throw new Error('Amount must be positive');

  const wallet = await getWalletByIdentifier(target);
  if (!wallet) throw new Error(`Wallet not found for "${target}"`);

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Deduct from user wallet
    await walletQ.adjustBalance(conn, wallet.user_id || wallet.discord_id, cur, -amt);

    // Credit back to Master Wallet
    await walletQ.adjustMasterBalance(conn, cur, amt);

    // Record transaction
    const txid = await txQ.insertTransaction(conn, {
      userId: wallet.user_id || null,
      discordId: wallet.discord_id || null,
      type: 'withdraw',
      currency: cur,
      amount: amt,
      note,
    });

    await conn.commit();
    return txid;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

/**
 * Get wallet by discord_id.
 */
async function getWallet(discordId) {
  return walletQ.getWallet(discordId);
}

/**
 * Get wallet by wallet address.
 */
async function getWalletByAddress(address) {
  return walletQ.getWalletByAddress(address);
}

/**
 * Get master wallet balances.
 */
async function getMasterWallet() {
  return walletQ.getMasterWallet();
}

module.exports = {
  getOrCreateWallet,
  getWalletByUserId,
  getWalletByIdentifier,
  mint,
  burn,
  getWallet,
  getWalletByAddress,
  getMasterWallet,
};
